import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { defaultStatus, isDoneStatus } from '../utils/statuses.js';

/**
 * Creates a task with the next readable number (e.g. WEB-42), at the end of
 * the list. Used by the API route and by recurring templates.
 * `data` must already be validated; `checklist` is a list of texts.
 */
export async function createTaskRecord({ project, data, reporterId }) {
  // Atomic counter gives every task a readable, unique key such as WEB-42
  const { taskCounter } = await Project.findByIdAndUpdate(project._id, { $inc: { taskCounter: 1 } }, { new: true, projection: { taskCounter: 1 } });
  const last = await Task.findOne({ project: project._id }).sort({ order: -1 }).select('order').lean();
  const { checklist, ...fields } = data;
  const status = fields.status ?? defaultStatus(project);
  return Task.create({
    order: (last?.order ?? 0) + 1,
    ...fields,
    status,
    checklist: (checklist ?? []).map((text) => ({ text })),
    completedAt: isDoneStatus(project, status) ? new Date() : null,
    project: project._id,
    number: taskCounter,
    reporter: reporterId,
  });
}

/** Clean list of checklist texts sent by a client or stored on a template. */
export const cleanChecklist = (list) =>
  Array.isArray(list)
    ? list
        .map((text) => String(text ?? '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 50)
    : [];
