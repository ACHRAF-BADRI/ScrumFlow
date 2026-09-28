import crypto from 'crypto';

/*
 * Time-based one-time passwords (RFC 6238), as used by Google Authenticator,
 * 1Password, Authy… 6 digits, 30 second steps, HMAC-SHA1.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateSecret = () => base32Encode(crypto.randomBytes(20));

/** The 6-digit code of `secret` for the time step containing `time` (ms). */
export function totp(secret, time = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP)));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** Accepts the current code and the ones just before and after (clock drift). */
export function verifyTotp(secret, code, time = Date.now()) {
  const value = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(value) || !secret) return false;
  return [-1, 0, 1].some((drift) => {
    const expected = totp(secret, time + drift * STEP * 1000);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(value));
  });
}

export const otpauthUrl = ({ secret, email, issuer = 'ScrumFlow' }) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

/** One-time recovery codes like "k3f9-2m7q", shown once and stored hashed. */
export function recoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export const hashCode = (code) => crypto.createHash('sha256').update(String(code).trim().toLowerCase()).digest('hex');
