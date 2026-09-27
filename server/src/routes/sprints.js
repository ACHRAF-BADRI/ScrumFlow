import { Router } from 'express';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import { isValidId, requireProject } from '../middleware/auth.js';
import { badRequest, notFound, pick } from '../utils/httpError.js';
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
  const sprints = await Sprint.find({ project: req.project._id }).sort({ createdAt: 1 });
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

  const tasks = await Task.find({ sprint: sprint._id }).select('points status').lean();
  const unfinished = tasks.filter((t) => t.status !== 'done');
  await Task.updateMany({ _id: { $in: unfinished.map((t) => t._id) } }, { sprint: target });

  Object.assign(sprint, {
    status: 'completed',
    completedAt: new Date(),
    completedPoints: sumPoints(tasks.filter((t) => t.status === 'done')),
  });
  await sprint.save();
  await logActivity({ project: req.project, actor: req.user, type: 'sprint.completed', data: { name: sprint.name, moved: unfinished.length } });
  res.json({ sprint, moved: unfinished.length });
});

export default router;
