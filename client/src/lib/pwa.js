import { useEffect, useState } from 'react';
import { API_URL } from './api';

/** Registers the service worker (production builds only, so dev reloads stay simple). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?api=${encodeURIComponent(new URL(API_URL).origin)}`).catch(() => {});
  });
}

/** Forget cached API answers (called on logout: they belong to the previous user). */
export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage('clear-api');
}

// The browser offers installation once; keep the event for our own button
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn(false));
  });
}

/** { canInstall, install } for an "Install the app" button. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred));
  useEffect(() => {
    listeners.add(setCanInstall);
    return () => listeners.delete(setCanInstall);
  }, []);
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    setCanInstall(false);
  };
  return { canInstall, install };
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
