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
    // Max tasks in this column on the board, 0 = no limit (WIP limit)
    wipLimit: { type: Number, min: 0, max: 99, default: 0 },
  },
  { _id: false }
);

export const REPEAT_FREQUENCIES = ['none', 'daily', 'weekly', 'monthly'];

/**
 * Task template: pre-filled fields and checklist. With a repeat rule, the
 * API creates a task from it on schedule (services/recurring.js).
 */
const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    type: { type: String, default: 'task' },
    priority: { type: String, default: 'medium' },
    points: { type: Number, min: 0, max: 100, default: 0 },
    labels: [{ type: String, trim: true, maxlength: 30 }],
    checklist: [{ type: String, trim: true, maxlength: 200 }],
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    repeat: {
      frequency: { type: String, enum: REPEAT_FREQUENCIES, default: 'none' },
      weekday: { type: Number, min: 0, max: 6, default: 1 }, // weekly: 0 = Sunday
      monthDay: { type: Number, min: 1, max: 28, default: 1 }, // monthly
      target: { type: String, enum: ['backlog', 'sprint'], default: 'sprint' }, // sprint = the active one, if any
      nextRun: { type: Date, default: null },
      lastRun: { type: Date, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
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
    templates: [templateSchema],
    // Read-only public link (/share/<token>); null = not shared. Only managers can read it.
    shareToken: { type: String, default: null, select: false },
    // GitHub webhook: the secret signs GitHub's requests; merged PRs can finish tasks
    github: {
      secret: { type: String, select: false },
      repo: { type: String, default: '' },
      autoClose: { type: Boolean, default: true },
      connectedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });
projectSchema.index({ 'templates.repeat.nextRun': 1 });
projectSchema.index({ shareToken: 1 }, { unique: true, partialFilterExpression: { shareToken: { $type: 'string' } } });

projectSchema.methods.roleOf = function roleOf(userId) {
  const member = this.members.find((m) => String(m.user?._id ?? m.user) === String(userId));
  return member?.role ?? null;
};

export default mongoose.model('Project', projectSchema);
