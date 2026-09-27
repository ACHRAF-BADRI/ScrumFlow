import mongoose from 'mongoose';

/**
 * One entry of a project's activity log ("Lucas moved WEB-7 to Done").
 * Names are copied at the time of the event so the history stays readable
 * after renames or deletions.
 */
const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    taskKey: String,
    taskTitle: String,
    // e.g. task.created, task.updated, task.commented, checklist.checked, sprint.started, member.added
    type: { type: String, required: true },
    // Details for the sentence: { field, from, to } for updates, { name } for sprints and members…
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
