import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseCloudinaryUrl } from '../src/utils/cloudinaryUrl.js';

// Built here so no credential-like text sits in the code
const key = String(Date.now());
const secret = `s${Math.random().toString(36).slice(2)}`;
const good = `cloudinary://${key}:${secret}@democloud`;

describe('CLOUDINARY_URL', () => {
  test('the dashboard line is read, with what often comes along when copying it', () => {
    for (const value of [good, `  ${good}\n`, `"${good}"`, `'${good}'`, `CLOUDINARY_URL=${good}`]) {
      assert.deepEqual(parseCloudinaryUrl(value).config, { apiKey: key, apiSecret: secret, cloudName: 'democloud' }, value);
    }
  });

  test('unusable values explain why, empty stays silent', () => {
    assert.deepEqual(parseCloudinaryUrl(''), { config: null, reason: null });
    assert.match(parseCloudinaryUrl(`cloudinary://${key}:<your_api_secret>@democloud`).reason, /placeholder/);
    assert.match(parseCloudinaryUrl(`https://${key}:${secret}@democloud`).reason, /cloudinary:\/\//);
    assert.match(parseCloudinaryUrl(`cloudinary://${key}@democloud`).reason, /expected/);
  });
});
