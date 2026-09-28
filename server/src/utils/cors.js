import { config } from '../config.js';

const host = (url) => url.replace(/^https?:\/\//, '');

/**
 * Same rule for the REST API and the realtime socket: tools without an origin
 * (curl, health checks), the configured CLIENT_URL origins, and the Cloudflare
 * Pages preview deployments of those sites (https://preview.site.pages.dev).
 */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.clientUrls.includes(origin)) return true;
  return config.clientUrls.some((url) => url.endsWith('.pages.dev') && /^https:\/\/[a-z0-9-]+\./.test(origin) && origin.endsWith(`.${host(url)}`));
}
