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

/**
 * AI provider: AI_PROVIDER (groq, gemini, openrouter, anthropic), or the first
 * one whose key is set. AI_MODEL overrides the default model.
 */
const AI_KEYS = { groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
function aiConfig() {
  const wanted = String(process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  const provider = AI_KEYS[wanted] ? wanted : Object.keys(AI_KEYS).find((name) => process.env[AI_KEYS[name]]);
  const apiKey = provider && process.env[AI_KEYS[provider]]?.trim();
  if (!apiKey) return null;
  return { provider, apiKey, model: process.env.AI_MODEL?.trim() || null, dailyLimit: Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30) };
}

const pair = (id, secret) => (process.env[id] && process.env[secret] ? { clientId: process.env[id], clientSecret: process.env[secret] } : null);
const port = Number(process.env.PORT) || 5000;

export const config = {
  port,
  // Public URL of this API (OAuth redirects, webhook URLs). Render sets RENDER_EXTERNAL_URL itself.
  apiUrl: (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Keep only the origin, so "https://site.pages.dev/login" or a trailing "/" still match
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
  // Main platform admin, created at startup from these values
  admin: {
    email: String(process.env.ADMIN_EMAIL ?? '').toLowerCase().trim() || null,
    password: process.env.ADMIN_PASSWORD || null,
    name: String(process.env.ADMIN_NAME ?? '').trim() || 'Admin',
  },
  // Optional: AI suggestions appear when a provider key is set
  ai: aiConfig(),
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
