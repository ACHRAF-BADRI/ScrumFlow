import { config } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found`, code: 'errors.notFound' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message, code: 'errors.validation' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}`, code: 'errors.badRequest' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const code = field === 'email' ? 'errors.emailTaken' : 'errors.duplicate';
    return res.status(409).json({ message: `${field} already exists`, code });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 && config.isProd ? 'Internal server error' : err.message,
    code: err.code && typeof err.code === 'string' ? err.code : 'errors.server',
  });
}
