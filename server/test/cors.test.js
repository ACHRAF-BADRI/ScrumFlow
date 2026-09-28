import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, test } from 'node:test';

// The config needs these to load; CI has no .env file (values generated for each run)
process.env.MONGODB_URI ??= 'mongodb://placeholder';
process.env.JWT_SECRET ??= crypto.randomBytes(32).toString('hex');
const { config } = await import('../src/config.js');
const { isAllowedOrigin } = await import('../src/utils/cors.js');

describe('allowed front-end origins', () => {
  test('configured sites and their preview deployments, nothing else', () => {
    const saved = config.clientUrls;
    config.clientUrls = ['https://scrumflow.pages.dev'];
    try {
      assert.equal(isAllowedOrigin(undefined), true, 'no origin: curl, health checks');
      assert.equal(isAllowedOrigin('https://scrumflow.pages.dev'), true);
      assert.equal(isAllowedOrigin('https://feature-admin.scrumflow.pages.dev'), true, 'Cloudflare preview');
      assert.equal(isAllowedOrigin('https://scrumflow-board.netlify.app'), false, 'the old site is no longer allowed');
      assert.equal(isAllowedOrigin('https://evilscrumflow.pages.dev'), false, 'look-alike project');
      assert.equal(isAllowedOrigin('http://feature.scrumflow.pages.dev'), false, 'https only');
      assert.equal(isAllowedOrigin('https://other.pages.dev'), false);
      assert.equal(isAllowedOrigin('https://scrumflow.pages.dev.evil.com'), false);
    } finally {
      config.clientUrls = saved;
    }
  });
});
