import crypto from 'crypto';
import mongoose from 'mongoose';

export const INVITE_DAYS = 7;

/** Invitation to join a project, for someone who doesn't have an account yet. */
const invitationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    // Only the hash is stored: the raw token lives in the emailed link
    tokenHash: { type: String, required: true, index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ project: 1, email: 1 }, { unique: true });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('hex');

/** Pending (not accepted, not expired) invitations. */
invitationSchema.statics.pending = function pending(filter = {}) {
  return this.find({ ...filter, acceptedAt: null, expiresAt: { $gt: new Date() } });
};

export default mongoose.model('Invitation', invitationSchema);
