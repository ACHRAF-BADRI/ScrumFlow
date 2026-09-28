import crypto from 'crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import Project, { ROLES } from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task, { TASK_PRIORITIES } from '../models/Task.js';
import { isDoneStatus, sanitizeStatuses, statusesOf } from '../utils/statuses.js';
import User from '../models/User.js';
import Invitation, { INVITE_DAYS, hashToken, newToken } from '../models/Invitation.js';
import { invitationEmail } from '../emails/templates.js';
import { appUrl, sendEmail } from '../utils/mailer.js';
import { notifyAddedToProject } from '../services/notify.js';
import { emitToUser } from '../realtime.js';
import Notification from '../models/Notification.js';
import Activity from '../models/Activity.js';
import { logActivity } from '../services/activity.js';
import { requireProject } from '../middleware/auth.js';
import { config } from '../config.js';
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
          // $gt null: true for a date, false when missing or null
          done: { $sum: { $cond: [{ $gt: ['$completedAt', null] }, 1, 0] } },
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
  let removed = [];
  if (req.body?.statuses !== undefined) {
    const next = sanitizeStatuses(req.body.statuses);
    const previous = statusesOf(req.project).map((s) => ({ key: s.key, category: s.category }));
    removed = previous.filter((p) => !next.some((n) => n.key === p.key));
    req.project.statuses = next;
  }
  await req.project.save();
  if (req.body?.statuses !== undefined) await syncTasksWithWorkflow(req.project, removed);
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project });
});

router.delete('/:projectId', requireProject(['owner']), async (req, res) => {
  const projectId = req.project._id;
  const memberIds = req.project.members.map((m) => String(m.user));
  await Promise.all([
    Notification.deleteMany({ project: projectId }),
    Activity.deleteMany({ project: projectId }),
    Task.deleteMany({ project: projectId }),
    Sprint.deleteMany({ project: projectId }),
    Invitation.deleteMany({ project: projectId }),
  ]);
  await req.project.deleteOne();
  memberIds.forEach((id) => emitToUser(id, 'projects:changed'));
  res.status(204).end();
});

// ---- Team members -------------------------------------------------------

router.post('/:projectId/members', requireProject(MANAGERS), async (req, res) => {
  const { email, role = 'member' } = req.body || {};
  if (!email) throw badRequest('Email is required', 'errors.missingFields');
  if (!['admin', 'member'].includes(role)) throw badRequest('Invalid role', 'errors.badRequest');

  const normalized = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest('Invalid email', 'errors.invalidEmail');
  const user = await User.findOne({ email: normalized });

  // No account yet: create (or refresh) an invitation and email the link
  if (!user) {
    const token = newToken();
    await Invitation.findOneAndUpdate(
      { project: req.project._id, email: normalized },
      { role, tokenHash: hashToken(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000), acceptedAt: null },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const inviteUrl = appUrl(`/invite/${token}`);
    const mail = await sendEmail(
      invitationEmail({ to: normalized, lang: req.user.language, inviterName: req.user.name, projectName: req.project.name, role, url: inviteUrl })
    );
    // The link is returned so the inviter can share it if the email couldn't leave
    return res.status(202).json({ invited: true, email: normalized, emailSent: mail.sent, inviteUrl });
  }

  if (req.project.roleOf(user._id)) throw badRequest('User is already a member', 'errors.alreadyMember');
  req.project.members.push({ user: user._id, role });
  await req.project.save();
  await req.project.populate('members.user', MEMBER_FIELDS);
  notifyAddedToProject({ actor: req.user, project: req.project, user, role }).catch(() => {});
  await logActivity({ project: req.project, actor: req.user, type: 'member.added', data: { name: user.name, role } });
  res.status(201).json({ project: req.project });
});

// Pending invitations (people who don't have an account yet)
router.get('/:projectId/invitations', requireProject(MANAGERS), async (req, res) => {
  const invitations = await Invitation.pending({ project: req.project._id })
    .select('email role expiresAt createdAt invitedBy')
    .populate('invitedBy', 'name')
    .sort({ createdAt: -1 });
  res.json({ invitations });
});

router.delete('/:projectId/invitations/:invitationId', requireProject(MANAGERS), async (req, res) => {
  const { deletedCount } = await Invitation.deleteOne({ _id: req.params.invitationId, project: req.project._id });
  if (!deletedCount) throw notFound('Invitation not found', 'errors.notFound');
  res.status(204).end();
});

// Activity log of the project, newest first; `before` (ISO date) loads older entries
router.get('/:projectId/activity', requireProject(), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const filter = { project: req.project._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
  if (req.query.actor && mongoose.isValidObjectId(req.query.actor)) filter.actor = req.query.actor;
  const activity = await Activity.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate('actor', 'name avatarColor');
  res.json({ activity: activity.slice(0, limit), hasMore: activity.length > limit });
});

router.patch('/:projectId/members/:userId', requireProject(MANAGERS), async (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role) || role === 'owner') throw badRequest('Invalid role', 'errors.badRequest');

  const member = req.project.members.find((m) => String(m.user) === req.params.userId);
  if (!member) throw notFound('Member not found', 'errors.notFound');
  if (member.role === 'owner') throw forbidden('The owner role cannot be changed', 'errors.ownerLocked');

  member.role = role;
  await req.project.save();
  const target = await User.findById(req.params.userId).select('name');
  await logActivity({ project: req.project, actor: req.user, type: 'member.role', data: { name: target?.name, role } });
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
  emitToUser(userId, 'projects:changed');
  const removed = await User.findById(userId).select('name');
  await logActivity({ project: req.project, actor: req.user, type: isSelf ? 'member.left' : 'member.removed', data: { name: removed?.name } });
  // Unassign their work so it shows up as unassigned instead of pointing at a non-member
  await Task.updateMany({ project: req.project._id, assignee: userId }, { assignee: null });
  await req.project.populate('members.user', MEMBER_FIELDS);
  res.json({ project: req.project });
});

// ---- Dashboard statistics -----------------------------------------------

/**
 * After a workflow change: tasks of a deleted status move to the first status
 * of the same category (or the first one), and completedAt follows each
 * status's category.
 */
async function syncTasksWithWorkflow(project, removed) {
  const statuses = statusesOf(project);
  for (const old of removed) {
    const target = statuses.find((s) => s.category === old.category) ?? statuses[0];
    await Task.updateMany({ project: project._id, status: old.key }, { status: target.key });
  }
  for (const s of statuses) {
    if (isDoneStatus(project, s.key)) {
      await Task.updateMany({ project: project._id, status: s.key, completedAt: null }, { completedAt: new Date() });
    } else {
      await Task.updateMany({ project: project._id, status: s.key, completedAt: { $ne: null } }, { completedAt: null });
    }
  }
}

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
    Task.find({ project: projectId }).select('status priority points assignee sprint epic type title number completedAt dueDate').lean(),
    Sprint.find({ project: projectId }).sort({ createdAt: 1 }).lean(),
  ]);

  const countBy = (keys, field) => Object.fromEntries(keys.map((k) => [k, tasks.filter((t) => t[field] === k).length]));
  const statusKeys = statusesOf(req.project).map((s) => s.key);

  const byAssignee = {};
  for (const t of tasks) {
    const id = t.assignee ? String(t.assignee) : 'unassigned';
    byAssignee[id] ??= { total: 0, done: 0, points: 0 };
    byAssignee[id].total += 1;
    byAssignee[id].points += t.points || 0;
    if (t.completedAt) byAssignee[id].done += 1;
  }

  const velocity = sprints
    .filter((s) => s.status === 'completed')
    .slice(-8)
    .map((s) => ({ sprint: s.name, committed: s.committedPoints, completed: s.completedPoints }));

  /*
   * Burndown and burnup of one sprint: ?sprint=<id>, else the active one, else
   * the last completed. A completed sprint's open work moved to another sprint,
   * so its scope is the points committed when it was closed.
   */
  let burndown = null;
  const started = sprints.filter((s) => s.status !== 'planned' && s.startDate && s.endDate);
  const chosen =
    started.find((s) => String(s._id) === String(req.query.sprint)) ?? started.find((s) => s.status === 'active') ?? started.filter((s) => s.status === 'completed').at(-1);
  if (chosen) {
    const sprintTasks = tasks.filter((t) => String(t.sprint) === String(chosen._id));
    const total = chosen.status === 'completed' ? Math.max(chosen.committedPoints, sumPoints(sprintTasks)) : sumPoints(sprintTasks);
    const start = startOfDay(chosen.startDate);
    const days = Math.max(1, Math.round((startOfDay(chosen.endDate) - start) / DAY));
    const last = startOfDay(chosen.status === 'completed' && chosen.completedAt ? chosen.completedAt : new Date());

    burndown = { sprintId: chosen._id, sprint: chosen.name, status: chosen.status, total, points: [] };
    for (let i = 0; i <= days; i += 1) {
      const day = new Date(start.getTime() + i * DAY);
      const endOfDay = new Date(day.getTime() + DAY - 1);
      const burned = sumPoints(sprintTasks.filter((t) => t.completedAt && new Date(t.completedAt) <= endOfDay));
      const known = day <= last;
      burndown.points.push({
        date: day.toISOString(),
        ideal: Math.round((total - (total / days) * i) * 10) / 10,
        remaining: known ? total - burned : null,
        done: known ? burned : null,
        scope: total,
      });
    }
  }

  // Progress of each epic, from its stories
  const epics = tasks
    .filter((t) => t.type === 'epic')
    .map((epic) => {
      const stories = tasks.filter((t) => String(t.epic) === String(epic._id));
      const doneStories = stories.filter((t) => t.completedAt);
      return {
        _id: epic._id,
        key: `${req.project.key}-${epic.number}`,
        title: epic.title,
        total: stories.length,
        done: doneStories.length,
        points: sumPoints(stories),
        donePoints: sumPoints(doneStories),
      };
    });

  const now = new Date();
  const done = tasks.filter((t) => t.completedAt);
  res.json({
    totals: {
      tasks: tasks.length,
      done: done.length,
      points: sumPoints(tasks),
      donePoints: sumPoints(done),
      overdue: tasks.filter((t) => t.dueDate && !t.completedAt && new Date(t.dueDate) < now).length,
      backlog: tasks.filter((t) => !t.sprint).length,
    },
    byStatus: countBy(statusKeys, 'status'),
    byPriority: countBy(TASK_PRIORITIES, 'priority'),
    byAssignee,
    velocity,
    burndown,
    sprints: started.map((s) => ({ _id: s._id, name: s.name, status: s.status })),
    epics,
  });
});

/**
 * Cumulative flow: how many tasks were in each status at the end of each of
 * the last `days` days. Rebuilt from the activity log, walking status changes
 * back from today's state.
 */
router.get('/:projectId/flow', requireProject(), async (req, res) => {
  const today = startOfDay(new Date());
  // A young project starts at its creation (a week at least), not with weeks of empty chart
  const age = Math.round((today - startOfDay(req.project.createdAt)) / DAY) + 1;
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90, Math.max(age, 7));
  const from = new Date(today.getTime() - (days - 1) * DAY);
  const [tasks, changes] = await Promise.all([
    Task.find({ project: req.project._id }).select('status createdAt').lean(),
    Activity.find({ project: req.project._id, type: 'task.updated', 'data.field': 'status', createdAt: { $gte: from } })
      .select('task data.from createdAt')
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const byTask = new Map();
  for (const c of changes) {
    const id = String(c.task);
    if (!byTask.has(id)) byTask.set(id, []);
    byTask.get(id).push(c); // newest first
  }
  const keys = statusesOf(req.project).map((s) => s.key);
  const points = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(from.getTime() + i * DAY);
    const end = new Date(day.getTime() + DAY - 1);
    const row = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const task of tasks) {
      if (new Date(task.createdAt) > end) continue;
      let status = task.status;
      for (const c of byTask.get(String(task._id)) ?? []) {
        if (new Date(c.createdAt) <= end) break;
        status = c.data?.from ?? status;
      }
      if (status in row) row[status] += 1;
    }
    points.push({ date: day.toISOString(), ...row });
  }
  res.json({ days: points });
});

// ---- GitHub integration (webhook) ------------------------------------------------

async function githubState(projectId) {
  const { github } = await Project.findById(projectId).select('+github.secret').lean();
  const connected = Boolean(github?.secret);
  return {
    connected,
    repo: github?.repo ?? '',
    autoClose: github?.autoClose ?? true,
    webhookUrl: `${config.apiUrl}/api/webhooks/github/${projectId}`,
    secret: connected ? github.secret : null,
  };
}

router.get('/:projectId/github', requireProject(MANAGERS), async (req, res) => {
  res.json(await githubState(req.project._id));
});

// Connect, or create a new secret (the old one stops working)
router.post('/:projectId/github', requireProject(MANAGERS), async (req, res) => {
  await Project.updateOne(
    { _id: req.project._id },
    { 'github.secret': crypto.randomBytes(24).toString('hex'), 'github.connectedAt': new Date() }
  );
  res.json(await githubState(req.project._id));
});

router.patch('/:projectId/github', requireProject(MANAGERS), async (req, res) => {
  if (req.body?.autoClose !== undefined) await Project.updateOne({ _id: req.project._id }, { 'github.autoClose': Boolean(req.body.autoClose) });
  res.json(await githubState(req.project._id));
});

router.delete('/:projectId/github', requireProject(MANAGERS), async (req, res) => {
  await Project.updateOne({ _id: req.project._id }, { $unset: { 'github.secret': 1 }, 'github.repo': '', 'github.connectedAt': null });
  res.json(await githubState(req.project._id));
});

// ---- Public read-only link ----------------------------------------------------

router.get('/:projectId/share', requireProject(MANAGERS), async (req, res) => {
  const { shareToken } = await Project.findById(req.project._id).select('+shareToken').lean();
  res.json({ token: shareToken ?? null });
});

// Creates the link, or replaces it (the old link stops working)
router.post('/:projectId/share', requireProject(MANAGERS), async (req, res) => {
  const token = crypto.randomBytes(18).toString('base64url');
  await Project.updateOne({ _id: req.project._id }, { shareToken: token });
  await logActivity({ project: req.project, actor: req.user, type: 'project.shared' });
  res.json({ token });
});

router.delete('/:projectId/share', requireProject(MANAGERS), async (req, res) => {
  await Project.updateOne({ _id: req.project._id }, { shareToken: null });
  await logActivity({ project: req.project, actor: req.user, type: 'project.unshared' });
  res.json({ token: null });
});

export default router;
