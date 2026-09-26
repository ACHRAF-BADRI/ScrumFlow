import { Router } from 'express';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task, { TASK_STATUSES } from '../models/Task.js';
import { isValidId, requireProject } from '../middleware/auth.js';
import { badRequest, forbidden, notFound, pick } from '../utils/httpError.js';

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
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

// Bulk position update after a drag & drop: [{ id, status?, sprint?, order }]
router.post('/reorder', requireProject(), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
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
  res.json({ updated: ops.length });
});

router.get('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.patch('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const data = await validateRefs(req, pick(req.body, EDITABLE));
  Object.assign(task, data);
  await task.save();
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const canDelete = ['owner', 'admin'].includes(req.role) || String(task.reporter) === String(req.user._id);
  if (!canDelete) throw forbidden('Only the reporter or a project admin can delete this task', 'errors.forbidden');
  await task.deleteOne();
  res.status(204).end();
});

router.post('/:taskId/comments', requireProject(), async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) throw badRequest('Comment cannot be empty', 'errors.missingFields');
  const task = await loadTask(req);
  task.comments.push({ author: req.user._id, text });
  await task.save();
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

export default router;
