import { Router } from 'express';
import Project, { ROLES } from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task, { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';
import User from '../models/User.js';
import { requireProject } from '../middleware/auth.js';
import { badRequest, forbidden, notFound, pick } from '../utils/httpError.js';

const router = Router();
const MANAGERS = ['owner', 'admin'];
const MEMBER_FIELDS = 'name email avatarColor';

function makeKey(name) {
  const letters = String(name).replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const words = letters.split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : letters.slice(0, 3);
  return (key || 'PRJ').slice(0, 6).toUpperCase();
}

// List the projects the current user belongs to, with light task stats
router.get('/', async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id })
    .populate('members.user', MEMBER_FIELDS)
    .sort({ updatedAt: -1 })
    .lean();
  const ids = projects.map((p) => p._id);
  const [counts, activeSprints] = await Promise.all([
    Task.aggregate([
      { $match: { project: { $in: ids } } },
      {
        $group: {
          _id: '$project',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ]),
    Sprint.find({ project: { $in: ids }, status: 'active' }).select('project name endDate').lean(),
  ]);

  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  res.json({
    projects: projects.map((p) => ({
      ...p,
      stats: { total: byId[p._id]?.total ?? 0, done: byId[p._id]?.done ?? 0 },
      activeSprint: activeSprints.find((s) => String(s.project) === String(p._id)) ?? null,
    })),
  });
});

router.post('/', async (req, res) => {
  const { name, description, color, key } = req.body || {};
  if (!name?.trim()) throw badRequest('Project name is required', 'errors.missingFields');

  const project = await Project.create({
    name,
    description,
    color,
    key: key?.trim() ? key : makeKey(name),
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
  });
  await project.populate('members.user', MEMBER_FIELDS);
  res.status(201).json({ project });
});

router.get('/:projectId', requireProject(), async (req, res) => {
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project, role: req.role });
});

router.patch('/:projectId', requireProject(MANAGERS), async (req, res) => {
  Object.assign(req.project, pick(req.body, ['name', 'description', 'color', 'key']));
  await req.project.save();
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project });
});

router.delete('/:projectId', requireProject(['owner']), async (req, res) => {
  const projectId = req.project._id;
  await Promise.all([Task.deleteMany({ project: projectId }), Sprint.deleteMany({ project: projectId })]);
  await req.project.deleteOne();
  res.status(204).end();
});

// ---- Team members -------------------------------------------------------

router.post('/:projectId/members', requireProject(MANAGERS), async (req, res) => {
  const { email, role = 'member' } = req.body || {};
  if (!email) throw badRequest('Email is required', 'errors.missingFields');
  if (!['admin', 'member'].includes(role)) throw badRequest('Invalid role', 'errors.badRequest');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw notFound('No user with this email. Ask them to sign up first.', 'errors.userNotFound');
  if (req.project.roleOf(user._id)) throw badRequest('User is already a member', 'errors.alreadyMember');

  req.project.members.push({ user: user._id, role });
  await req.project.save();
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.status(201).json({ project: req.project });
});

router.patch('/:projectId/members/:userId', requireProject(MANAGERS), async (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role) || role === 'owner') throw badRequest('Invalid role', 'errors.badRequest');

  const member = req.project.members.find((m) => String(m.user) === req.params.userId);
  if (!member) throw notFound('Member not found', 'errors.notFound');
  if (member.role === 'owner') throw forbidden('The owner role cannot be changed', 'errors.ownerLocked');

  member.role = role;
  await req.project.save();
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project });
});

router.delete('/:projectId/members/:userId', requireProject(), async (req, res) => {
  const { userId } = req.params;
  const isSelf = String(req.user._id) === userId;
  if (!isSelf && !MANAGERS.includes(req.role)) throw forbidden();

  const member = req.project.members.find((m) => String(m.user) === userId);
  if (!member) throw notFound('Member not found', 'errors.notFound');
  if (member.role === 'owner') throw forbidden('The owner cannot be removed', 'errors.ownerLocked');

  req.project.members = req.project.members.filter((m) => String(m.user) !== userId);
  await req.project.save();
  // Unassign their work so it shows up as unassigned instead of pointing at a non-member
  await Task.updateMany({ project: req.project._id, assignee: userId }, { assignee: null });
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project });
});

// ---- Dashboard statistics -----------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sumPoints = (list) => list.reduce((sum, t) => sum + (t.points || 0), 0);

router.get('/:projectId/stats', requireProject(), async (req, res) => {
  const projectId = req.project._id;
  const [tasks, sprints] = await Promise.all([
    Task.find({ project: projectId }).select('status priority points assignee sprint completedAt dueDate').lean(),
    Sprint.find({ project: projectId }).sort({ createdAt: 1 }).lean(),
  ]);

  const countBy = (keys, field) => Object.fromEntries(keys.map((k) => [k, tasks.filter((t) => t[field] === k).length]));

  const byAssignee = {};
  for (const t of tasks) {
    const id = t.assignee ? String(t.assignee) : 'unassigned';
    byAssignee[id] ??= { total: 0, done: 0, points: 0 };
    byAssignee[id].total += 1;
    byAssignee[id].points += t.points || 0;
    if (t.status === 'done') byAssignee[id].done += 1;
  }

  const velocity = sprints
    .filter((s) => s.status === 'completed')
    .slice(-8)
    .map((s) => ({ sprint: s.name, committed: s.committedPoints, completed: s.completedPoints }));

  // Burndown for the active sprint: remaining points at the end of each day
  let burndown = null;
  const active = sprints.find((s) => s.status === 'active');
  if (active?.startDate && active?.endDate) {
    const sprintTasks = tasks.filter((t) => String(t.sprint) === String(active._id));
    const total = sumPoints(sprintTasks);
    const start = startOfDay(active.startDate);
    const days = Math.max(1, Math.round((startOfDay(active.endDate) - start) / DAY));
    const today = startOfDay(new Date());

    burndown = { sprint: active.name, total, points: [] };
    for (let i = 0; i <= days; i += 1) {
      const day = new Date(start.getTime() + i * DAY);
      const endOfDay = new Date(day.getTime() + DAY - 1);
      const burned = sumPoints(sprintTasks.filter((t) => t.completedAt && new Date(t.completedAt) <= endOfDay));
      burndown.points.push({
        date: day.toISOString(),
        ideal: Math.round((total - (total / days) * i) * 10) / 10,
        remaining: day <= today ? total - burned : null,
      });
    }
  }

  const now = new Date();
  const done = tasks.filter((t) => t.status === 'done');
  res.json({
    totals: {
      tasks: tasks.length,
      done: done.length,
      points: sumPoints(tasks),
      donePoints: sumPoints(done),
      overdue: tasks.filter((t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now).length,
      backlog: tasks.filter((t) => !t.sprint).length,
    },
    byStatus: countBy(TASK_STATUSES, 'status'),
    byPriority: countBy(TASK_PRIORITIES, 'priority'),
    byAssignee,
    velocity,
    burndown,
  });
});

export default router;
