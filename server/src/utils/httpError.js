export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    // Stable machine-readable code the client can translate (e.g. "auth.invalid")
    this.code = code;
  }
}

export const badRequest = (msg, code = 'errors.badRequest') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Unauthorized', code = 'errors.unauthorized') => new HttpError(401, msg, code);
export const forbidden = (msg = 'Forbidden', code = 'errors.forbidden') => new HttpError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'errors.notFound') => new HttpError(404, msg, code);

/** Copy only the whitelisted keys that are present in `body`. */
export function pick(body, keys) {
  const out = {};
  for (const key of keys) if (body?.[key] !== undefined) out[key] = body[key];
  return out;
}
