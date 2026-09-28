import mongoose from 'mongoose';

/** What platform admins did, and to whom (names are copied so the log stays readable). */
const adminLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    // e.g. user.created, user.updated, user.suspended, user.deleted, admin.granted, task.deleted
    action: { type: String, required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetName: String,
    targetEmail: String,
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminLogSchema.index({ createdAt: -1 });

export default mongoose.model('AdminLog', adminLogSchema);
