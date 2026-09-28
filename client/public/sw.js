/*
 * ScrumFlow service worker: makes the app installable and readable offline.
 *  - pages: network first, the cached app shell when offline
 *  - built assets (/assets/*, hashed names): cache first
 *  - API reads (GET): network first, the last answer when offline
 * Writes are never cached or queued. The API cache is cleared on logout.
 */
const VERSION = 'v1';
const SHELL = `sf-shell-${VERSION}`;
const ASSETS = `sf-assets-${VERSION}`;
const API_CACHE = `sf-api-${VERSION}`;
const API_ORIGIN = new URL(self.location.href).searchParams.get('api') || '';
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, API_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-api') event.waitUntil(caches.delete(API_CACHE));
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Realtime and uploads are live only
  if (url.pathname.startsWith('/socket.io')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (API_ORIGIN && url.origin === API_ORIGIN && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/oauth')) {
    event.respondWith(networkFirst(request, API_CACHE));
  }
});
