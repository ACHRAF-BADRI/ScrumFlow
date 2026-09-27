import { Router } from 'express';
import Sprint, { RETRO_COLUMNS } from '../models/Sprint.js';
import Project from '../models/Project.js';
import { defaultStatus } from '../utils/statuses.js';
import Task from '../models/Task.js';
import { isValidId, requireProject } from '../middleware/auth.js';
import { badRequest, forbidden, notFound, pick } from '../utils/httpError.js';
import { logActivity } from '../services/activity.js';

// Mounted at /api/projects/:projectId/sprints
const router = Router({ mergeParams: true });
const MANAGERS = ['owner', 'admin'];
const DEFAULT_SPRINT_DAYS = 14;

async function loadSprint(req) {
  const { sprintId } = req.params;
  if (!isValidId(sprintId)) throw notFound('Sprint not found', 'errors.sprintNotFound');
  const sprint = await Sprint.findOne({ _id: sprintId, project: req.project._id });
  if (!sprint) throw notFound('Sprint not found', 'errors.sprintNotFound');
  return sprint;
}

const sumPoints = (tasks) => tasks.reduce((sum, t) => sum + (t.points || 0), 0);

router.get('/', requireProject(), async (req, res) => {
  // The retrospective is loaded on its own page
  const sprints = await Sprint.find({ project: req.project._id }).select('-retro').sort({ createdAt: 1 });
  res.json({ sprints });
});

router.post('/', requireProject(MANAGERS), async (req, res) => {
  const count = await Sprint.countDocuments({ project: req.project._id });
  const sprint = await Sprint.create({
    ...pick(req.body, ['goal', 'startDate', 'endDate']),
    name: req.body?.name?.trim() || `Sprint ${count + 1}`,
    project: req.project._id,
  });
  await logActivity({ project: req.project, actor: req.user, type: 'sprint.created', data: { name: sprint.name } });
  res.status(201).json({ sprint });
});

router.patch('/:sprintId', requireProject(MANAGERS), async (req, res) => {
  const sprint = await loadSprint(req);
  Object.assign(sprint, pick(req.body, ['name', 'goal', 'startDate', 'endDate']));
  await sprint.save();
  res.json({ sprint });
});

router.delete('/:sprintId', requireProject(MANAGERS), async (req, res) => {
  const sprint = await loadSprint(req);
  if (sprint.status === 'active') throw badRequest('Complete the sprint before deleting it', 'errors.sprintActive');
  // Completed sprints feed velocity and history; deleting one would also push its done tasks back to the backlog
  if (sprint.status === 'completed') {
    throw badRequest('Completed sprints are kept for history and cannot be deleted', 'errors.sprintCompletedLocked');
  }
  // Tasks go back to the product backlog rather than being deleted
  await Task.updateMany({ sprint: sprint._id }, { sprint: null });
  await sprint.deleteOne();
  await logActivity({ project: req.project, actor: req.user, type: 'sprint.deleted', data: { name: sprint.name } });
  res.status(204).end();
});

router.post('/:sprintId/start', requireProject(MANAGERS), async (req, res) => {
  const sprint = await loadSprint(req);
  if (sprint.status !== 'planned') throw badRequest('Only planned sprints can be started', 'errors.sprintNotPlanned');

  const alreadyActive = await Sprint.exists({ project: req.project._id, status: 'active' });
  if (alreadyActive) throw badRequest('Another sprint is already active', 'errors.sprintAlreadyActive');

  const tasks = await Task.find({ sprint: sprint._id }).select('points').lean();
  if (tasks.length === 0) throw badRequest('Add tasks to the sprint before starting it', 'errors.sprintEmpty');

  const start = req.body?.startDate ? new Date(req.body.startDate) : sprint.startDate || new Date();
  const end =
    req.body?.endDate ? new Date(req.body.endDate)
    : sprint.endDate && sprint.endDate > start ? sprint.endDate
    : new Date(start.getTime() + DEFAULT_SPRINT_DAYS * 24 * 60 * 60 * 1000);

  Object.assign(sprint, {
    status: 'active',
    startDate: start,
    endDate: end,
    goal: req.body?.goal ?? sprint.goal,
    committedPoints: sumPoints(tasks),
  });
  await sprint.save();
  await logActivity({ project: req.project, actor: req.user, type: 'sprint.started', data: { name: sprint.name } });
  res.json({ sprint });
});

/**
 * Close the sprint. Unfinished tasks move to the backlog or to another
 * planned sprint (`moveTo`), like Jira / Azure Boards do.
 */
router.post('/:sprintId/complete', requireProject(MANAGERS), async (req, res) => {
  const sprint = await loadSprint(req);
  if (sprint.status !== 'active') throw badRequest('Only the active sprint can be completed', 'errors.sprintNotActive');

  let target = null;
  const { moveTo } = req.body || {};
  if (moveTo && moveTo !== 'backlog') {
    if (!isValidId(moveTo)) throw badRequest('Invalid target sprint', 'errors.badRequest');
    const next = await Sprint.findOne({ _id: moveTo, project: req.project._id, status: 'planned' });
    if (!next) throw badRequest('Target sprint must be a planned sprint', 'errors.badRequest');
    target = next._id;
  }

  const tasks = await Task.find({ sprint: sprint._id }).select('points status completedAt').lean();
  const unfinished = tasks.filter((t) => !t.completedAt);
  await Task.updateMany({ _id: { $in: unfinished.map((t) => t._id) } }, { sprint: target });

  Object.assign(sprint, {
    status: 'completed',
    completedAt: new Date(),
    completedPoints: sumPoints(tasks.filter((t) => t.completedAt)),
  });
  await sprint.save();
  await logActivity({ project: req.project, actor: req.user, type: 'sprint.completed', data: { name: sprint.name, moved: unfinished.length } });
  res.json({ sprint, moved: unfinished.length });
});

// ---- Retrospective (active and completed sprints, any member) ----------------

const retroView = (sprint) =>
  Sprint.findById(sprint._id)
    .select('name goal status startDate endDate completedAt retro')
    .populate('retro.author', 'name avatarColor');

async function loadRetroSprint(req) {
  const sprint = await loadSprint(req);
  if (sprint.status === 'planned') throw badRequest('Start the sprint before its retrospective', 'errors.retroPlanned');
  return sprint;
}

router.get('/:sprintId/retro', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  res.json({ sprint: await retroView(sprint) });
});

router.post('/:sprintId/retro', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  const text = String(req.body?.text ?? '').trim();
  if (!RETRO_COLUMNS.includes(req.body?.column)) throw badRequest('Invalid column', 'errors.badRequest');
  if (!text) throw badRequest('The card cannot be empty', 'errors.missingFields');
  if (sprint.retro.length >= 200) throw badRequest('Too many cards', 'errors.badRequest');
  sprint.retro.push({ column: req.body.column, text: text.slice(0, 300), author: req.user._id });
  await sprint.save();
  res.status(201).json({ sprint: await retroView(sprint) });
});

function retroItem(sprint, itemId) {
  const item = sprint.retro.id(itemId);
  if (!item) throw notFound('Card not found', 'errors.notFound');
  return item;
}
const canEditCard = (req, item) => String(item.author) === String(req.user._id) || MANAGERS.includes(req.role);

router.patch('/:sprintId/retro/:itemId', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  const item = retroItem(sprint, req.params.itemId);
  if (req.body?.text !== undefined) {
    if (!canEditCard(req, item)) throw forbidden();
    const text = String(req.body.text).trim();
    if (!text) throw badRequest('The card cannot be empty', 'errors.missingFields');
    item.text = text.slice(0, 300);
  }
  if (req.body?.done !== undefined) item.done = Boolean(req.body.done);
  await sprint.save();
  res.json({ sprint: await retroView(sprint) });
});

// One vote per person, clicking again removes it
router.post('/:sprintId/retro/:itemId/vote', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  const item = retroItem(sprint, req.params.itemId);
  const me = String(req.user._id);
  item.votes = item.votes.some((v) => String(v) === me) ? item.votes.filter((v) => String(v) !== me) : [...item.votes, req.user._id];
  await sprint.save();
  res.json({ sprint: await retroView(sprint) });
});

router.delete('/:sprintId/retro/:itemId', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  const item = retroItem(sprint, req.params.itemId);
  if (!canEditCard(req, item)) throw forbidden();
  item.deleteOne();
  await sprint.save();
  res.json({ sprint: await retroView(sprint) });
});

// Turn an action into a real task in the backlog
router.post('/:sprintId/retro/:itemId/task', requireProject(), async (req, res) => {
  const sprint = await loadRetroSprint(req);
  const item = retroItem(sprint, req.params.itemId);
  if (item.column !== 'actions') throw badRequest('Only actions can become tasks', 'errors.badRequest');
  if (item.task) throw badRequest('This action is already a task', 'errors.badRequest');
  const { taskCounter } = await Project.findByIdAndUpdate(req.project._id, { $inc: { taskCounter: 1 } }, { new: true, projection: { taskCounter: 1 } });
  const last = await Task.findOne({ project: req.project._id }).sort({ order: -1 }).select('order').lean();
  const task = await Task.create({
    project: req.project._id,
    number: taskCounter,
    title: item.text.slice(0, 200),
    type: 'task',
    status: defaultStatus(req.project),
    reporter: req.user._id,
    order: (last?.order ?? 0) + 1,
    labels: ['retro'],
  });
  item.task = task._id;
  await sprint.save();
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.created' });
  res.status(201).json({ sprint: await retroView(sprint), task });
});

export default router;
