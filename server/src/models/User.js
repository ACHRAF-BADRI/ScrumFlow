import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    // Accounts linked with "Sign in with…" (provider user ids)
    oauth: {
      google: { type: String, default: undefined },
      github: { type: String, default: undefined },
      microsoft: { type: String, default: undefined },
      gitlab: { type: String, default: undefined },
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
    if (ret.twoFactor) ret.twoFactor = { enabled: Boolean(ret.twoFactor.enabled) };
    if (ret.oauth) ret.oauth = { google: Boolean(ret.oauth.google), github: Boolean(ret.oauth.github), microsoft: Boolean(ret.oauth.microsoft), gitlab: Boolean(ret.oauth.gitlab) };
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
