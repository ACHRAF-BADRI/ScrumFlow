import axios from 'axios';
import { api } from './api';

export class UploadError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * Uploads a file straight to Cloudinary with a signature from our API, then
 * saves it on the task. `base` is the task URL, e.g. /projects/1/tasks/2.
 * Returns { task, attachment }.
 */
export async function uploadAttachment(base, file, onProgress) {
  const { data: sign } = await api.post(`${base}/attachments/sign`);
  if (file.size > sign.maxSize) throw new UploadError('errors.fileTooLarge');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', sign.timestamp);
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);
  let uploaded;
  try {
    // Plain axios: no auth header or wake-up toast for a third-party request
    ({ data: uploaded } = await axios.post(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`, form, {
      onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
    }));
  } catch {
    throw new UploadError('errors.uploadFailed');
  }

  const { data } = await api.post(`${base}/attachments`, {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type,
    name: file.name || `image.${uploaded.format ?? 'png'}`,
    size: file.size,
    mime: file.type,
  });
  return data;
}

/** Smaller image from Cloudinary for previews. */
export const thumbnail = (url, width = 320, height = 200) => url.replace('/image/upload/', `/image/upload/c_fill,w_${width},h_${height},q_auto,f_auto/`);

export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
