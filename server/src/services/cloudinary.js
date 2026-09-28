import crypto from 'crypto';
import { config } from '../config.js';

/*
 * Cloudinary without the SDK: the browser uploads files directly with a
 * short-lived signature from the API, so files never go through Render.
 * https://cloudinary.com/documentation/authentication_signatures
 */
export const attachmentsEnabled = () => Boolean(config.cloudinary);
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const folderFor = (projectId) => `scrumflow/${projectId}`;

export function signParams(params) {
  const payload = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(payload + config.cloudinary.apiSecret).digest('hex');
}

/** Upload parameters for one file of a project. */
export function uploadSignature(projectId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = folderFor(projectId);
  return {
    cloudName: config.cloudinary.cloudName,
    apiKey: config.cloudinary.apiKey,
    timestamp,
    folder,
    signature: signParams({ folder, timestamp }),
  };
}

/** Only accept files that really come from our Cloudinary account and this project's folder. */
export function isOwnUpload(projectId, { url, publicId }) {
  const prefix = `https://res.cloudinary.com/${config.cloudinary.cloudName}/`;
  return typeof url === 'string' && url.startsWith(prefix) && typeof publicId === 'string' && publicId.startsWith(`${folderFor(projectId)}/`);
}

/** Best effort: a file left on Cloudinary is not worth failing the request. */
export async function destroyFile({ publicId, resourceType = 'raw' }) {
  if (!attachmentsEnabled() || process.env.NODE_ENV === 'test') return;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: config.cloudinary.apiKey,
      signature: signParams({ public_id: publicId, timestamp }),
    });
    await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/destroy`, { method: 'POST', body });
  } catch (err) {
    console.warn('[cloudinary]', err.message);
  }
}
