import { config } from '../config.js';

/** Absolute link to a page of the front end (first CLIENT_URL). */
export const appUrl = (path = '') => `${config.clientUrls[0]}${path}`;

/**
 * Sends an email through the Resend REST API. Never throws: the result says
 * whether the email left, so callers can offer a fallback (e.g. a link to copy).
 * Without RESEND_API_KEY, emails are skipped and logged (handy in development).
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!config.resendApiKey) {
    console.info(`[email skipped, no RESEND_API_KEY] to=${to} subject="${subject}"`);
    if (!config.isProd) console.info(text);
    return { sent: false, reason: 'disabled' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Typical in test mode: Resend only delivers to the account owner until a domain is verified
      console.warn(`[email failed] to=${to} status=${response.status} ${data.message ?? ''}`);
      return { sent: false, reason: data.message ?? `HTTP ${response.status}` };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    console.warn(`[email failed] to=${to} ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

/** Fire and forget, for notifications that must not slow down the request. */
export function sendInBackground(email) {
  sendEmail(email).catch(() => {});
}
