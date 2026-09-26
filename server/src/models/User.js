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
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
