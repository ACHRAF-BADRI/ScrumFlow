import mongoose from 'mongoose';

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

// A file stored on Cloudinary (uploaded by the browser with a signature from the API)
const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, maxlength: 500 },
    publicId: { type: String, required: true, maxlength: 300 },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], default: 'raw' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    size: { type: Number, min: 0, default: 0 },
    mime: { type: String, maxlength: 120, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    // null = product backlog
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null, index: true },
    // Parent epic (a task of type "epic" in the same project)
    epic: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    type: { type: String, enum: TASK_TYPES, default: 'task' },
    // Key of one of the project's statuses (validated by the routes)
    status: { type: String, default: 'todo', maxlength: 40 },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    points: { type: Number, min: 0, max: 100, default: 0 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date, default: null },
    labels: [{ type: String, trim: true, maxlength: 30 }],
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    comments: [commentSchema],
    // Tasks of the same project that must be finished before this one
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    // Subtasks: small steps inside the task, with their own done state
    checklist: [checklistItemSchema],
    attachments: [attachmentSchema],
    // Commits and pull requests that mention the task key (GitHub webhook)
    links: [
      {
        kind: { type: String, enum: ['commit', 'pr'], required: true },
        url: { type: String, required: true, maxlength: 500 },
        title: { type: String, maxlength: 200, default: '' },
        ref: { type: String, maxlength: 40, default: '' },
        state: { type: String, maxlength: 20, default: '' },
        author: { type: String, maxlength: 100, default: '' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, number: 1 }, { unique: true });

export default mongoose.model('Task', taskSchema);
