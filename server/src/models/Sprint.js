import mongoose from 'mongoose';

export const SPRINT_STATUSES = ['planned', 'active', 'completed'];
export const RETRO_COLUMNS = ['wentWell', 'toImprove', 'actions'];

const retroItemSchema = new mongoose.Schema(
  {
    column: { type: String, enum: RETRO_COLUMNS, required: true },
    text: { type: String, required: true, trim: true, maxlength: 300 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    done: { type: Boolean, default: false }, // for action items
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null }, // action turned into a task
  },
  { timestamps: true }
);

const sprintSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    goal: { type: String, default: '', maxlength: 300 },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: SPRINT_STATUSES, default: 'planned' },
    completedAt: Date,
    // Story points delivered when the sprint was closed (used for velocity)
    completedPoints: { type: Number, default: 0 },
    committedPoints: { type: Number, default: 0 },
    // Sprint retrospective: what went well, what to improve, actions
    retro: [retroItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Sprint', sprintSchema);
