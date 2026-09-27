import mongoose from 'mongoose';
import { CATEGORIES, DEFAULT_STATUSES } from '../utils/statuses.js';

export const ROLES = ['owner', 'admin', 'member'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'member' },
  },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, maxlength: 40 },
    label: { type: String, trim: true, maxlength: 30, default: '' },
    color: { type: String, default: '#a1a3b8' },
    category: { type: String, enum: CATEGORIES, default: 'in_progress' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true, uppercase: true, trim: true, maxlength: 6 },
    description: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '#6161ff' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    // Board columns / workflow, in order (see utils/statuses.js)
    statuses: { type: [statusSchema], default: () => DEFAULT_STATUSES.map((s) => ({ ...s })) },
    // Incremented atomically to give tasks human-readable keys (e.g. WEB-12)
    taskCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });

projectSchema.methods.roleOf = function roleOf(userId) {
  const member = this.members.find((m) => String(m.user?._id ?? m.user) === String(userId));
  return member?.role ?? null;
};

export default mongoose.model('Project', projectSchema);
