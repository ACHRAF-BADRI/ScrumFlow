import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['assigned', 'mention', 'added'];

/** In-app notification (the bell). Emails are sent separately, if enabled. */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    // Snapshot so the list stays readable even if the task is renamed or deleted
    projectName: String,
    taskKey: String,
    taskTitle: String,
    excerpt: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
