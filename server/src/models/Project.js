import mongoose from 'mongoose';

export const ROLES = ['owner', 'admin', 'member'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'member' },
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
