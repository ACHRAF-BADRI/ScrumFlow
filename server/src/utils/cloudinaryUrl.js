/**
 * Reads CLOUDINARY_URL: cloudinary://<api key>:<api secret>@<cloud name>, as
 * shown on the Cloudinary dashboard. Forgives what often comes along when the
 * line is copied: spaces, quotes, or the "CLOUDINARY_URL=" prefix itself.
 * Returns { apiKey, apiSecret, cloudName }, or null (with the reason) when unusable.
 */
export function parseCloudinaryUrl(input) {
  const value = String(input ?? '')
    .trim()
    .replace(/^CLOUDINARY_URL\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!value) return { config: null, reason: null };
  if (value.includes('<') || value.includes('>')) return { config: null, reason: 'still contains a placeholder such as <your_api_secret>' };
  try {
    const url = new URL(value);
    if (url.protocol !== 'cloudinary:') return { config: null, reason: 'must start with cloudinary://' };
    if (!url.username || !url.password || !url.hostname) return { config: null, reason: 'expected cloudinary://<api key>:<api secret>@<cloud name>' };
    return {
      config: { apiKey: decodeURIComponent(url.username), apiSecret: decodeURIComponent(url.password), cloudName: url.hostname },
      reason: null,
    };
  } catch {
    return { config: null, reason: 'is not a valid URL' };
  }
}
