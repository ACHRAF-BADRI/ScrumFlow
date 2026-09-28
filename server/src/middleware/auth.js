import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { forbidden, notFound, unauthorized } from '../utils/httpError.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Short-lived proof that the password (or Google/GitHub) was right; the 6-digit code comes next. */
export function signTwoFactorTicket(user) {
  return jwt.sign({ sub: String(user._id), purpose: '2fa' }, config.jwtSecret, { expiresIn: '10m' });
}

/** Session tokens only: tickets and OAuth states carry a `purpose` and never open a session. */
export function verifySession(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (payload.purpose) throw new Error('not a session token');
  return payload;
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = verifySession(token);
  } catch {
    throw unauthorized('Invalid or expired token', 'errors.sessionExpired');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('User no longer exists', 'errors.sessionExpired');
  req.user = user;
  next();
}

export function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

/**
 * Loads the project from `req.params[param]` (or a resolver) and checks that
 * the current user is a member with one of the allowed roles.
 */
export async function loadProjectFor(req, projectId, roles) {
  if (!isValidId(projectId)) throw notFound('Project not found', 'errors.projectNotFound');
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project not found', 'errors.projectNotFound');

  const role = project.roleOf(req.user._id);
  if (!role) throw notFound('Project not found', 'errors.projectNotFound');
  if (roles && !roles.includes(role)) throw forbidden('Insufficient permissions', 'errors.forbidden');

  req.project = project;
  req.role = role;
  return project;
}

export const requireProject = (roles) => async (req, _res, next) => {
  await loadProjectFor(req, req.params.projectId, roles);
  next();
};
