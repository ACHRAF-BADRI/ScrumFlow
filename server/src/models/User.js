import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

const isRootEmail = (email) => Boolean(config.admin.email) && String(email ?? '').toLowerCase() === config.admin.email;

const OAUTH_PROVIDERS = ['google', 'microsoft', 'github', 'gitlab', 'bitbucket'];
const AVATAR_COLORS = ['#6161ff', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc', '#ff642e', '#037f4c'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    avatarColor: {
      type: String,
      default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
    language: { type: String, enum: ['en', 'fr'], default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    // Onboarding tours the user has finished or skipped (e.g. "home", "project")
    tours: { type: [String], default: [] },
    // Projects starred by this user (personal, shown first)
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    // Emails for assigned tasks and @mentions
    emailNotifications: { type: Boolean, default: true },
    // Platform admin access (the main admin is the ADMIN_EMAIL account, see services/admin.js)
    isAdmin: { type: Boolean, default: false },
    // Suspended accounts cannot sign in; their sessions stop working
    suspended: { type: Boolean, default: false },
    suspendedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Keyed hash of ADMIN_PASSWORD, to know when it changed on the server
    adminFingerprint: { type: String, select: false },
    // Accounts linked with "Sign in with…" (provider user ids)
    oauth: {
      google: { type: String, default: undefined },
      github: { type: String, default: undefined },
      microsoft: { type: String, default: undefined },
      gitlab: { type: String, default: undefined },
      bitbucket: { type: String, default: undefined },
    },
    // Two-step verification with an authenticator app (TOTP)
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
      recoveryCodes: { type: [String], select: false }, // sha256 of each unused code
    },
    // Saved filter sets ("views"), per project
    savedFilters: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
        name: { type: String, required: true, trim: true, maxlength: 40 },
        filters: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    // Forgot password: hash of the emailed token, valid for one hour
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.resetPasswordHash;
    delete ret.resetPasswordExpires;
    delete ret.savedFilters;
    delete ret.adminFingerprint;
    // The client shows the admin area when this is true (main admin included)
    ret.isAdmin = Boolean(ret.isAdmin) || isRootEmail(ret.email);
    if (isRootEmail(ret.email)) ret.isRootAdmin = true;
    if (ret.twoFactor) ret.twoFactor = { enabled: Boolean(ret.twoFactor.enabled) };
    // Only whether each provider is linked, never the provider ids
    if (ret.oauth) ret.oauth = Object.fromEntries(OAUTH_PROVIDERS.map((name) => [name, Boolean(ret.oauth[name])]));
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
