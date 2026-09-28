import crypto from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import User from '../models/User.js';
import { providers } from '../services/oauth.js';
import { joinPendingInvitations } from '../services/invitations.js';
import { signToken, signTwoFactorTicket } from '../middleware/auth.js';

// Mounted at /api/auth/oauth
const router = Router();
const clientUrl = (path) => `${config.clientUrls[0]}${path}`;

// Step 1: send the browser to the provider, with a signed state against CSRF
router.get('/:provider', (req, res) => {
  const provider = providers[req.params.provider];
  if (!provider?.enabled()) return res.redirect(clientUrl('/login?oauthError=disabled'));
  const lang = req.query.lang === 'fr' ? 'fr' : 'en';
  const state = jwt.sign({ purpose: 'oauth', provider: req.params.provider, lang, nonce: crypto.randomBytes(8).toString('hex') }, config.jwtSecret, { expiresIn: '10m' });
  return res.redirect(provider.authorizeUrl(state));
});

/**
 * Step 2: the provider comes back with a code. Same email = same account
 * (an account created with a password can then also sign in with Google).
 * The session token goes back to the app in the URL fragment, which is never
 * sent to a server.
 */
router.get('/:provider/callback', async (req, res) => {
  const { provider: name } = req.params;
  const provider = providers[name];
  let state;
  try {
    state = jwt.verify(String(req.query.state ?? ''), config.jwtSecret);
  } catch {
    state = null;
  }
  if (!provider?.enabled() || state?.purpose !== 'oauth' || state.provider !== name || !req.query.code) {
    return res.redirect(clientUrl('/login?oauthError=failed'));
  }

  try {
    const profile = await provider.profile(String(req.query.code));
    if (!profile.email) return res.redirect(clientUrl('/login?oauthError=noEmail'));
    const email = profile.email.toLowerCase();
    let user = await User.findOne({ email }).select('+twoFactor.secret');
    let created = false;
    if (!user) {
      // No password to remember: a random one, "Forgot password" can set a real one later
      user = await User.create({ name: String(profile.name).slice(0, 60), email, password: crypto.randomBytes(24).toString('hex'), language: state.lang });
      await joinPendingInvitations(user);
      created = true;
    }
    if (user.oauth?.[name] !== profile.id) {
      user.set(`oauth.${name}`, profile.id);
      await user.save();
    }
    if (user.suspended) return res.redirect(clientUrl('/login?oauthError=suspended'));
    if (user.twoFactor?.enabled) return res.redirect(clientUrl(`/oauth#ticket=${signTwoFactorTicket(user)}`));
    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
    return res.redirect(clientUrl(`/oauth#token=${signToken(user)}${created ? '&new=1' : ''}`));
  } catch (err) {
    console.warn(`[oauth:${name}]`, err.message);
    return res.redirect(clientUrl('/login?oauthError=failed'));
  }
});

export default router;
