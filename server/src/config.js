import dotenv from 'dotenv';
import { parseCloudinaryUrl } from './utils/cloudinaryUrl.js';

dotenv.config({ quiet: true });

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const cloudinary = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
// Set but unusable: say why in the logs (never the value), attachments stay off
if (cloudinary.reason) console.warn(`CLOUDINARY_URL ${cloudinary.reason}: attachments are turned off`);

const pair = (id, secret) => (process.env[id] && process.env[secret] ? { clientId: process.env[id], clientSecret: process.env[secret] } : null);
const port = Number(process.env.PORT) || 5000;

export const config = {
  port,
  // Public URL of this API (OAuth redirects, webhook URLs). Render sets RENDER_EXTERNAL_URL itself.
  apiUrl: (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Keep only the origin, so "https://site.netlify.app/login" or a trailing "/" still match
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => {
      const value = url.trim();
      try {
        return new URL(value).origin;
      } catch {
        return value.replace(/\/$/, '');
      }
    })
    .filter(Boolean),
  isProd: process.env.NODE_ENV === 'production',
  // Optional: emails are disabled when no Resend key is set
  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || 'ScrumFlow <onboarding@resend.dev>',
  // Optional: task attachments are hidden when Cloudinary is not configured
  cloudinary: cloudinary.config,
  // Optional: "Sign in with…" buttons appear when their keys are set
  // gitlab.com by default, or a self-hosted GitLab
  gitlabUrl: (process.env.GITLAB_URL || 'https://gitlab.com').replace(/\/$/, ''),
  oauth: {
    google: pair('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    github: pair('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'),
    microsoft: pair('MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'),
    gitlab: pair('GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET'),
    bitbucket: pair('BITBUCKET_CLIENT_ID', 'BITBUCKET_CLIENT_SECRET'),
  },
};
