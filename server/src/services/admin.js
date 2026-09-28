import crypto from 'crypto';
import { config } from '../config.js';
import AdminLog from '../models/AdminLog.js';
import User from '../models/User.js';

/*
 * Platform administration. The main administrator is the account whose email
 * is ADMIN_EMAIL (set on the server only); it can give or take back admin
 * access. Other admins can manage users but not other admins' access.
 */
export const isRootEmail = (email) => Boolean(config.admin.email) && String(email ?? '').toLowerCase() === config.admin.email;
export const isRootAdmin = (user) => Boolean(user) && isRootEmail(user.email);
export const isAdmin = (user) => Boolean(user) && (Boolean(user.isAdmin) || isRootAdmin(user));

// Keyed hash of ADMIN_PASSWORD: shows when the value changed on the server, without storing it
const fingerprint = (password) => crypto.createHmac('sha256', config.jwtSecret).update(`admin:${password}`).digest('hex');

/**
 * Creates the main admin account from ADMIN_EMAIL / ADMIN_PASSWORD, or makes
 * the existing account with that email an admin. Its password follows
 * ADMIN_PASSWORD whenever that value changes on the server.
 */
export async function ensureRootAdmin() {
  const { email, password, name } = config.admin;
  if (!email || !password) return null;
  let user = await User.findOne({ email }).select('+password +adminFingerprint');
  const print = fingerprint(password);
  if (!user) {
    user = await User.create({ name, email, password, isAdmin: true, adminFingerprint: print, tours: ['home', 'project'] });
    console.log('[admin] main admin account created');
    return user;
  }
  let changed = false;
  if (user.adminFingerprint !== print) {
    user.password = password; // hashed by the pre-save hook
    user.adminFingerprint = print;
    changed = true;
  }
  if (!user.isAdmin || user.suspended) {
    user.isAdmin = true;
    user.suspended = false;
    user.suspendedAt = null;
    changed = true;
  }
  if (changed) {
    await user.save();
    console.log('[admin] main admin account updated');
  }
  return user;
}

/** Never throws: the audit log must not break the action it records. */
export async function logAdmin(actor, action, target = null, details = {}) {
  try {
    await AdminLog.create({
      actor: actor._id,
      actorName: actor.name,
      action,
      target: target?._id ?? null,
      targetName: target?.name,
      targetEmail: target?.email,
      details,
    });
  } catch (err) {
    console.warn('[admin log]', err.message);
  }
}
