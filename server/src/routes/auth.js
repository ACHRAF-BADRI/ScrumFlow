import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, pick, unauthorized } from '../utils/httpError.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, language } = req.body || {};
  if (!name || !email || !password) throw badRequest('Name, email and password are required', 'errors.missingFields');
  if (String(password).length < 6) throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');

  const user = await User.create({ name, email, password, language: language === 'fr' ? 'fr' : 'en' });
  res.status(201).json({ token: signToken(user), user });
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

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/me', requireAuth, async (req, res) => {
  Object.assign(req.user, pick(req.body, ['name', 'language', 'theme', 'avatarColor']));
  await req.user.save();
  res.json({ user: req.user });
});

export default router;
