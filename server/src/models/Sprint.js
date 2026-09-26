import mongoose from 'mongoose';

export const SPRINT_STATUSES = ['planned', 'active', 'completed'];

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
  },
  { timestamps: true }
);

export default mongoose.model('Sprint', sprintSchema);
