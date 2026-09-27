import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import Invitation, { hashToken, newToken } from '../models/Invitation.js';
import Notification from '../models/Notification.js';
import { resetPasswordEmail } from '../emails/templates.js';
import { appUrl, sendEmail } from '../utils/mailer.js';
import { joinPendingInvitations } from '../services/invitations.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, pick, unauthorized } from '../utils/httpError.js';

const router = Router();

// Not in automated tests, which create many accounts in a row
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, language } = req.body || {};
  if (!name || !email || !password) throw badRequest('Name, email and password are required', 'errors.missingFields');
  if (String(password).length < 6) throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');

  const user = await User.create({ name, email, password, language: language === 'fr' ? 'fr' : 'en' });
  // Invited before having an account: join those projects right away
  const joined = await joinPendingInvitations(user);
  res.status(201).json({ token: signToken(user), user, joined });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw badRequest('Email and password are required', 'errors.missingFields');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw unauthorized('Invalid email or password', 'errors.invalidCredentials');
  }
  res.json({ token: signToken(user), user });
});

const RESET_MINUTES = 60;

/**
 * Always answers 200, whether the email exists or not, so this endpoint can't
 * be used to find out who has an account.
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const user = email ? await User.findOne({ email }) : null;
  if (user) {
    const token = newToken();
    user.resetPasswordHash = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await user.save();
    await sendEmail(resetPasswordEmail({ to: user.email, lang: user.language, name: user.name, url: appUrl(`/reset-password/${token}`) }));
  }
  res.json({ ok: true });
});

// Choose a new password with the emailed token, then sign in directly
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!password || String(password).length < 6) throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');
  const user = await User.findOne({
    resetPasswordHash: hashToken(String(token ?? '')),
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordHash +resetPasswordExpires');
  if (!user) throw badRequest('This link is invalid or has expired', 'errors.resetInvalid');

  user.password = password;
  user.resetPasswordHash = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Checks the current password. 400 (not 401) so the client doesn't log the user out. */
async function assertPassword(userId, password) {
  const user = await User.findById(userId).select('+password');
  if (!password || !(await user.comparePassword(password))) {
    throw badRequest('Current password is incorrect', 'errors.wrongPassword');
  }
  return user;
}

router.patch('/me', requireAuth, async (req, res) => {
  const changes = pick(req.body, ['name', 'email', 'language', 'theme', 'avatarColor', 'tours', 'favorites', 'emailNotifications']);
  if (changes.emailNotifications !== undefined) changes.emailNotifications = Boolean(changes.emailNotifications);

  if (changes.name !== undefined) {
    changes.name = String(changes.name).trim();
    if (!changes.name) throw badRequest('Name is required', 'errors.missingFields');
  }
  if (changes.avatarColor !== undefined && !HEX_RE.test(changes.avatarColor)) {
    throw badRequest('Invalid color', 'errors.badRequest');
  }
  if (changes.favorites !== undefined) {
    if (!Array.isArray(changes.favorites)) throw badRequest('favorites must be an array', 'errors.badRequest');
    changes.favorites = [...new Set(changes.favorites.map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, 200);
  }
  if (changes.tours !== undefined) {
    if (!Array.isArray(changes.tours)) throw badRequest('tours must be an array', 'errors.badRequest');
    changes.tours = [...new Set(changes.tours.map(String).filter((id) => id.length <= 30))].slice(0, 20);
  }
  // Changing the sign-in email requires the current password
  if (changes.email !== undefined) {
    changes.email = String(changes.email).toLowerCase().trim();
    if (!EMAIL_RE.test(changes.email)) throw badRequest('Invalid email', 'errors.invalidEmail');
    if (changes.email === req.user.email) delete changes.email;
    else await assertPassword(req.user._id, req.body.currentPassword);
  }

  Object.assign(req.user, changes);
  await req.user.save();
  res.json({ user: req.user });
});

router.post('/me/password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');
  }
  const user = await assertPassword(req.user._id, currentPassword);
  user.password = newPassword; // hashed by the pre-save hook
  await user.save();
  res.json({ ok: true });
});

/**
 * Delete the account. The client must send the user's exact name as `confirm`.
 * Owned projects shared with others are handed over to an admin (or the oldest
 * member); projects the user is alone in are deleted with their sprints and tasks.
 */
router.delete('/me', requireAuth, authLimiter, async (req, res) => {
  const userId = req.user._id;
  if (String(req.body?.confirm ?? '').trim() !== req.user.name.trim()) {
    throw badRequest('Type your name exactly to confirm', 'errors.confirmMismatch');
  }

  const projects = await Project.find({ 'members.user': userId });
  let transferred = 0;
  let deleted = 0;
  for (const project of projects) {
    const others = project.members.filter((m) => String(m.user) !== String(userId));
    if (String(project.owner) === String(userId)) {
      if (others.length === 0) {
        await Promise.all([Task.deleteMany({ project: project._id }), Sprint.deleteMany({ project: project._id })]);
        await project.deleteOne();
        deleted += 1;
        continue;
      }
      const heir = others.find((m) => m.role === 'admin') ?? others[0];
      heir.role = 'owner';
      project.owner = heir.user;
      transferred += 1;
    }
    project.members = others;
    await project.save();
  }
  // Their open work becomes unassigned instead of pointing at a deleted account
  await Task.updateMany({ assignee: userId }, { assignee: null });
  await Invitation.deleteMany({ invitedBy: userId, acceptedAt: null });
  await Notification.deleteMany({ user: userId });
  await User.deleteOne({ _id: userId });

  res.json({ ok: true, transferred, deleted });
});

export default router;
