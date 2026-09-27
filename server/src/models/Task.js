import mongoose from 'mongoose';

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'stuck'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const TASK_TYPES = ['story', 'task', 'bug', 'epic'];

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const checklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    // null = product backlog
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null, index: true },
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    type: { type: String, enum: TASK_TYPES, default: 'task' },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    points: { type: Number, min: 0, max: 100, default: 0 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date, default: null },
    labels: [{ type: String, trim: true, maxlength: 30 }],
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    comments: [commentSchema],
    // Subtasks: small steps inside the task, with their own done state
    checklist: [checklistItemSchema],
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, number: 1 }, { unique: true });

// Keep completedAt in sync with the status so burndown charts stay accurate
taskSchema.pre('save', function syncCompletedAt() {
  if (!this.isModified('status')) return;
  if (this.status === 'done' && !this.completedAt) this.completedAt = new Date();
  if (this.status !== 'done') this.completedAt = null;
});

export default mongoose.model('Task', taskSchema);
