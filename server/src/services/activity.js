import Activity from '../models/Activity.js';
import Sprint from '../models/Sprint.js';
import User from '../models/User.js';

const toId = (value) => (value && typeof value === 'object' && value._id ? value._id : value) ?? null;
const same = (a, b) => String(toId(a) ?? '') === String(toId(b) ?? '');

/** Never throws: the activity log must not break the action it describes. */
export async function logActivity({ project, actor, task = null, type, data = {} }) {
  try {
    await Activity.create({
      project: toId(project),
      actor: actor?._id ?? null,
      actorName: actor?.name,
      task: task?._id ?? null,
      taskKey: task ? `${project.key}-${task.number}` : undefined,
      taskTitle: task?.title,
      type,
      data,
    });
  } catch (err) {
    console.warn('[activity]', err.message);
  }
}

// Fields worth a line in the history, and how to show their values
const TRACKED = ['title', 'status', 'priority', 'type', 'assignee', 'sprint', 'points', 'dueDate', 'description'];

async function names(model, ids) {
  const list = ids.filter(Boolean);
  if (!list.length) return {};
  const docs = await model.find({ _id: { $in: list } }).select('name');
  return Object.fromEntries(docs.map((d) => [String(d._id), d.name]));
}

/** One "task.updated" entry per tracked field that really changed. */
export async function logTaskChanges({ project, actor, before, after }) {
  const changed = TRACKED.filter((field) => {
    if (field === 'dueDate') return String(before.dueDate ?? '') !== String(after.dueDate ?? '');
    if (field === 'assignee' || field === 'sprint') return !same(before[field], after[field]);
    return (before[field] ?? '') !== (after[field] ?? '');
  });
  if (!changed.length) return;

  const users = changed.includes('assignee') ? await names(User, [toId(before.assignee), toId(after.assignee)]) : {};
  const sprints = changed.includes('sprint') ? await names(Sprint, [toId(before.sprint), toId(after.sprint)]) : {};
  const show = (field, value) => {
    if (field === 'assignee') return value ? users[String(toId(value))] ?? null : null;
    if (field === 'sprint') return value ? sprints[String(toId(value))] ?? null : null;
    if (field === 'dueDate') return value ? new Date(value).toISOString() : null;
    if (field === 'description') return null; // too long for a sentence
    return value ?? null;
  };

  for (const field of changed) {
    await logActivity({
      project,
      actor,
      task: after,
      type: 'task.updated',
      data: { field, from: show(field, before[field]), to: show(field, after[field]) },
    });
  }
}
