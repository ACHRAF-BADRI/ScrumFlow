import { Router } from 'express';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task, { TASK_STATUSES } from '../models/Task.js';
import { isValidId, requireProject } from '../middleware/auth.js';
import { badRequest, forbidden, notFound, pick } from '../utils/httpError.js';
import { notifyAssigned, notifyMentions } from '../services/notify.js';
import { logActivity, logTaskChanges } from '../services/activity.js';
import Activity from '../models/Activity.js';

// Mounted at /api/projects/:projectId/tasks
const router = Router({ mergeParams: true });
const EDITABLE = ['title', 'description', 'type', 'status', 'priority', 'points', 'assignee', 'sprint', 'dueDate', 'labels', 'order'];
const USER_FIELDS = 'name email avatarColor';

const withRefs = (query) =>
  query.populate('assignee', USER_FIELDS).populate('reporter', USER_FIELDS).populate('comments.author', USER_FIELDS);

async function loadTask(req) {
  const { taskId } = req.params;
  if (!isValidId(taskId)) throw notFound('Task not found', 'errors.taskNotFound');
  const task = await Task.findOne({ _id: taskId, project: req.project._id });
  if (!task) throw notFound('Task not found', 'errors.taskNotFound');
  return task;
}

/** Reject assignees outside the team and sprints from other projects. */
async function validateRefs(req, data) {
  if (data.assignee === '') data.assignee = null;
  if (data.sprint === '' || data.sprint === 'backlog') data.sprint = null;
  if (data.dueDate === '') data.dueDate = null;

  if (data.assignee && !req.project.roleOf(data.assignee)) {
    throw badRequest('Assignee must be a project member', 'errors.assigneeNotMember');
  }
  if (data.sprint) {
    if (!isValidId(data.sprint)) throw badRequest('Invalid sprint', 'errors.badRequest');
    const sprint = await Sprint.findOne({ _id: data.sprint, project: req.project._id }).select('status').lean();
    if (!sprint) throw badRequest('Invalid sprint', 'errors.badRequest');
    if (sprint.status === 'completed') throw badRequest('This sprint is already completed', 'errors.sprintCompleted');
  }
  if (Array.isArray(data.labels)) {
    data.labels = [...new Set(data.labels.map((l) => String(l).trim()).filter(Boolean))].slice(0, 10);
  }
  return data;
}

router.get('/', requireProject(), async (req, res) => {
  const filter = { project: req.project._id };
  if (req.query.sprint === 'backlog') filter.sprint = null;
  else if (req.query.sprint && isValidId(req.query.sprint)) filter.sprint = req.query.sprint;

  const tasks = await withRefs(Task.find(filter).sort({ order: 1, createdAt: 1 }));
  res.json({ tasks });
});

router.post('/', requireProject(), async (req, res) => {
  if (!req.body?.title?.trim()) throw badRequest('Title is required', 'errors.missingFields');
  const data = await validateRefs(req, pick(req.body, EDITABLE));

  // Atomic counter gives every task a readable, unique key such as WEB-42
  const { taskCounter } = await Project.findByIdAndUpdate(
    req.project._id,
    { $inc: { taskCounter: 1 } },
    { new: true, projection: { taskCounter: 1 } }
  );
  const last = await Task.findOne({ project: req.project._id }).sort({ order: -1 }).select('order').lean();

  const task = await Task.create({
    order: (last?.order ?? 0) + 1,
    ...data,
    project: req.project._id,
    number: taskCounter,
    reporter: req.user._id,
  });
  notifyAssigned({ actor: req.user, project: req.project, task, assigneeId: task.assignee }).catch(() => {});
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.created' });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

// Bulk position update after a drag & drop: [{ id, status?, sprint?, order }]
router.post('/reorder', requireProject(), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
  const withStatus = items.filter((i) => i.status !== undefined && isValidId(i.id));
  const before = withStatus.length
    ? await Task.find({ _id: { $in: withStatus.map((i) => i.id) }, project: req.project._id }).select('status number title')
    : [];
  const ops = [];
  for (const item of items) {
    if (!isValidId(item.id)) continue;
    const update = [{ $set: { order: Number(item.order) || 0 } }];
    if (item.status !== undefined) {
      if (!TASK_STATUSES.includes(item.status)) throw badRequest('Invalid status', 'errors.badRequest');
      // Keep the original completion date of tasks that were already done (burndown accuracy)
      const completedAt = item.status === 'done' ? { $ifNull: ['$completedAt', new Date()] } : null;
      update.push({ $set: { status: item.status, completedAt } });
    }
    ops.push({ updateOne: { filter: { _id: item.id, project: req.project._id }, update } });
  }
  if (ops.length) await Task.bulkWrite(ops);
  for (const task of before) {
    const next = withStatus.find((i) => String(i.id) === String(task._id))?.status;
    if (next && next !== task.status) {
      await logActivity({ project: req.project, actor: req.user, task, type: 'task.updated', data: { field: 'status', from: task.status, to: next } });
    }
  }
  res.json({ updated: ops.length });
});

router.get('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.patch('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const data = await validateRefs(req, pick(req.body, EDITABLE));
  const previousAssignee = task.assignee ? String(task.assignee) : null;
  const before = task.toObject();
  Object.assign(task, data);
  await task.save();
  await logTaskChanges({ project: req.project, actor: req.user, before, after: task });
  if ('assignee' in data && data.assignee && String(data.assignee) !== previousAssignee) {
    notifyAssigned({ actor: req.user, project: req.project, task, assigneeId: data.assignee }).catch(() => {});
  }
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const canDelete = ['owner', 'admin'].includes(req.role) || String(task.reporter) === String(req.user._id);
  if (!canDelete) throw forbidden('Only the reporter or a project admin can delete this task', 'errors.forbidden');
  await task.deleteOne();
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.deleted' });
  res.status(204).end();
});

router.post('/:taskId/comments', requireProject(), async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) throw badRequest('Comment cannot be empty', 'errors.missingFields');
  const task = await loadTask(req);
  task.comments.push({ author: req.user._id, text });
  await task.save();
  notifyMentions({ actor: req.user, project: req.project, task, text }).catch(() => {});
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.commented', data: { excerpt: text.slice(0, 140) } });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId/comments/:commentId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const comment = task.comments.id(req.params.commentId);
  if (!comment) throw notFound('Comment not found', 'errors.notFound');
  const canDelete = String(comment.author) === String(req.user._id) || ['owner', 'admin'].includes(req.role);
  if (!canDelete) throw forbidden();
  comment.deleteOne();
  await task.save();
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

// ---- Checklist (subtasks) ----------------------------------------------------

router.post('/:taskId/checklist', requireProject(), async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) throw badRequest('Checklist item cannot be empty', 'errors.missingFields');
  const task = await loadTask(req);
  if (task.checklist.length >= 50) throw badRequest('Too many checklist items', 'errors.badRequest');
  task.checklist.push({ text: text.slice(0, 200) });
  await task.save();
  await logActivity({ project: req.project, actor: req.user, task, type: 'checklist.added', data: { text } });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

router.patch('/:taskId/checklist/:itemId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const item = task.checklist.id(req.params.itemId);
  if (!item) throw notFound('Checklist item not found', 'errors.notFound');
  if (req.body?.text !== undefined) {
    const text = String(req.body.text).trim();
    if (!text) throw badRequest('Checklist item cannot be empty', 'errors.missingFields');
    item.text = text.slice(0, 200);
  }
  const toggled = req.body?.done !== undefined && Boolean(req.body.done) !== item.done;
  if (toggled) {
    item.done = Boolean(req.body.done);
    item.doneAt = item.done ? new Date() : null;
  }
  await task.save();
  if (toggled) {
    await logActivity({ project: req.project, actor: req.user, task, type: item.done ? 'checklist.checked' : 'checklist.unchecked', data: { text: item.text } });
  }
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId/checklist/:itemId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const item = task.checklist.id(req.params.itemId);
  if (!item) throw notFound('Checklist item not found', 'errors.notFound');
  item.deleteOne();
  await task.save();
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

// History of one task (task drawer)
router.get('/:taskId/activity', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const activity = await Activity.find({ task: task._id }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name avatarColor');
  res.json({ activity });
});

export default router;
