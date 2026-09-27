import { config } from '../config.js';

/**
 * Same rule for the REST API and the realtime socket: tools without an origin
 * (curl, health checks), the configured CLIENT_URL origins, and their
 * Netlify deploy previews.
 */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.clientUrls.includes(origin)) return true;
  return config.clientUrls.some((url) => url.endsWith('.netlify.app') && origin.endsWith(`--${url.replace(/^https?:\/\//, '')}`));
}
