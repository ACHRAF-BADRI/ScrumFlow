import { Router } from 'express';
import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import AdminLog from '../models/AdminLog.js';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { deleteUserAccount } from '../services/accounts.js';
import { isAdmin, isRootAdmin, logAdmin } from '../services/admin.js';
import { logActivity } from '../services/activity.js';
import { destroyFile } from '../services/cloudinary.js';
import { emitProjectChanged, emitToUser } from '../realtime.js';
import { hasStatus, isDoneStatus, statusLabel } from '../utils/statuses.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

// Mounted at /api/admin, behind requireAuth + requireAdmin
const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE = 25;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  avatarColor: u.avatarColor,
  language: u.language,
  isAdmin: isAdmin(u),
  isRootAdmin: isRootAdmin(u),
  suspended: Boolean(u.suspended),
  suspendedAt: u.suspendedAt ?? null,
  twoFactor: Boolean(u.twoFactor?.enabled),
  oauth: Object.entries(u.oauth ?? {})
    .filter(([, id]) => id)
    .map(([name]) => name),
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt ?? null,
});

async function loadUser(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('User not found', 'errors.userNotFound');
  const user = await User.findById(id);
  if (!user) throw notFound('User not found', 'errors.userNotFound');
  return user;
}

/**
 * Who may change whom: nobody touches the main admin but itself, and only the
 * main admin manages other admins.
 */
function assertCanManage(req, target) {
  if (isRootAdmin(target) && !isRootAdmin(req.user)) throw forbidden('Only the main admin can change this account', 'errors.adminProtected');
  if (isAdmin(target) && !isRootAdmin(req.user) && String(target._id) !== String(req.user._id)) {
    throw forbidden('Only the main admin can change other admins', 'errors.adminProtected');
  }
}

router.get('/stats', async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [users, admins, suspended, newUsers, active, projects, tasks, openTasks] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isAdmin: true }),
    User.countDocuments({ suspended: true }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ lastLoginAt: { $gte: weekAgo } }),
    Project.countDocuments(),
    Task.countDocuments(),
    Task.countDocuments({ completedAt: null }),
  ]);
  res.json({ users, admins, suspended, newUsers, active, projects, tasks, openTasks });
});

router.get('/users', async (req, res) => {
  const filter = {};
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q) filter.$or = [{ name: new RegExp(escapeRegExp(q), 'i') }, { email: new RegExp(escapeRegExp(q), 'i') }];
  if (req.query.filter === 'admins') filter.isAdmin = true;
  if (req.query.filter === 'suspended') filter.suspended = true;
  const page = Math.max(1, Number(req.query.page) || 1);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .lean(),
  ]);
  const ids = users.map((u) => u._id);
  const [projectCounts, taskCounts] = await Promise.all([
    Project.aggregate([{ $match: { 'members.user': { $in: ids } } }, { $unwind: '$members' }, { $match: { 'members.user': { $in: ids } } }, { $group: { _id: '$members.user', n: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { assignee: { $in: ids }, completedAt: null } }, { $group: { _id: '$assignee', n: { $sum: 1 } } }]),
  ]);
  const count = (list, id) => list.find((c) => String(c._id) === String(id))?.n ?? 0;
  res.json({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    users: users.map((u) => ({ ...publicUser(u), projects: count(projectCounts, u._id), openTasks: count(taskCounts, u._id) })),
  });
});

router.post('/users', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  if (!name || !email || !password) throw badRequest('Name, email and password are required', 'errors.missingFields');
  if (!EMAIL_RE.test(email)) throw badRequest('Invalid email', 'errors.invalidEmail');
  if (password.length < 6) throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');
  if (req.body?.isAdmin && !isRootAdmin(req.user)) throw forbidden('Only the main admin can create admins', 'errors.adminProtected');
  const user = await User.create({ name: name.slice(0, 60), email, password, language: req.body?.language === 'fr' ? 'fr' : 'en', isAdmin: Boolean(req.body?.isAdmin) });
  await logAdmin(req.user, 'user.created', user, { admin: user.isAdmin });
  res.status(201).json({ user: publicUser(user) });
});

// Everything about one user: projects, tasks, recent activity
router.get('/users/:id', async (req, res) => {
  const user = await loadUser(req.params.id);
  const projects = await Project.find({ 'members.user': user._id }).select('name key color members statuses owner').lean();
  const tasks = await Task.find({ $or: [{ assignee: user._id }, { reporter: user._id }] })
    .select('project sprint number title type status priority points dueDate completedAt assignee reporter updatedAt')
    .sort({ completedAt: 1, updatedAt: -1 })
    .limit(300)
    .lean();
  const sprintIds = [...new Set(tasks.map((t) => String(t.sprint)).filter((id) => id !== 'null'))];
  const sprints = await Sprint.find({ _id: { $in: sprintIds } }).select('name status').lean();
  const byProject = Object.fromEntries(projects.map((p) => [String(p._id), p]));
  // Tasks from projects the user left are shown with their own project
  const missing = [...new Set(tasks.map((t) => String(t.project)))].filter((id) => !byProject[id]);
  for (const p of await Project.find({ _id: { $in: missing } }).select('name key color statuses').lean()) byProject[String(p._id)] = p;
  const activity = await Activity.find({ actor: user._id }).sort({ createdAt: -1 }).limit(40).lean();

  res.json({
    user: publicUser(user),
    projects: projects.map((p) => ({
      _id: p._id,
      name: p.name,
      key: p.key,
      color: p.color,
      role: p.members.find((m) => String(m.user) === String(user._id))?.role,
      members: p.members.length,
    })),
    tasks: tasks.map((t) => {
      const project = byProject[String(t.project)];
      return {
        ...t,
        key: project ? `${project.key}-${t.number}` : `#${t.number}`,
        projectName: project?.name ?? '',
        projectColor: project?.color,
        statuses: project?.statuses ?? [],
        sprintName: sprints.find((s) => String(s._id) === String(t.sprint))?.name ?? null,
        role: String(t.assignee) === String(user._id) ? 'assignee' : 'reporter',
      };
    }),
    activity,
  });
});

router.patch('/users/:id', async (req, res) => {
  const user = await loadUser(req.params.id);
  assertCanManage(req, user);
  const body = req.body || {};
  const self = String(user._id) === String(req.user._id);
  const changes = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) throw badRequest('Name is required', 'errors.missingFields');
    changes.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!EMAIL_RE.test(email)) throw badRequest('Invalid email', 'errors.invalidEmail');
    if (isRootAdmin(user) && email !== user.email) throw forbidden('The main admin email is set on the server', 'errors.adminProtected');
    changes.email = email;
  }
  if (body.language !== undefined) changes.language = body.language === 'fr' ? 'fr' : 'en';
  if (body.password !== undefined) {
    if (String(body.password).length < 6) throw badRequest('Password must be at least 6 characters', 'errors.passwordTooShort');
    if (isRootAdmin(user)) throw forbidden('The main admin password is set on the server', 'errors.adminProtected');
  }
  if (body.suspended !== undefined) {
    if (self || isRootAdmin(user)) throw forbidden('This account cannot be suspended', 'errors.adminProtected');
    changes.suspended = Boolean(body.suspended);
    changes.suspendedAt = changes.suspended ? new Date() : null;
  }
  if (body.isAdmin !== undefined) {
    if (!isRootAdmin(req.user)) throw forbidden('Only the main admin can give admin access', 'errors.adminProtected');
    if (isRootAdmin(user)) throw forbidden('The main admin stays admin', 'errors.adminProtected');
    changes.isAdmin = Boolean(body.isAdmin);
  }

  const before = { suspended: Boolean(user.suspended), isAdmin: Boolean(user.isAdmin) };
  Object.assign(user, changes);
  if (body.password !== undefined) user.password = String(body.password);
  await user.save();

  const fields = Object.keys(changes).filter((k) => !['suspended', 'suspendedAt', 'isAdmin'].includes(k));
  if (fields.length || body.password !== undefined) await logAdmin(req.user, 'user.updated', user, { fields: [...fields, ...(body.password !== undefined ? ['password'] : [])] });
  if ('suspended' in changes && changes.suspended !== before.suspended) {
    await logAdmin(req.user, changes.suspended ? 'user.suspended' : 'user.restored', user);
    if (changes.suspended) emitToUser(user._id, 'account:suspended');
  }
  if ('isAdmin' in changes && changes.isAdmin !== before.isAdmin) await logAdmin(req.user, changes.isAdmin ? 'admin.granted' : 'admin.revoked', user);
  res.json({ user: publicUser(user) });
});

router.delete('/users/:id', async (req, res) => {
  const user = await loadUser(req.params.id);
  assertCanManage(req, user);
  if (String(user._id) === String(req.user._id) || isRootAdmin(user)) throw forbidden('This account cannot be deleted here', 'errors.adminProtected');
  emitToUser(user._id, 'account:suspended');
  const result = await deleteUserAccount(user._id);
  await logAdmin(req.user, 'user.deleted', user, result);
  res.json({ ok: true, ...result });
});

// ---- Acting on a user's tasks --------------------------------------------------

async function loadTask(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Task not found', 'errors.taskNotFound');
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found', 'errors.taskNotFound');
  const project = await Project.findById(task.project);
  return { task, project };
}

router.patch('/tasks/:taskId', async (req, res) => {
  const { task, project } = await loadTask(req.params.taskId);
  const body = req.body || {};
  const before = { status: task.status, assignee: task.assignee };
  if (body.status !== undefined) {
    if (!hasStatus(project, body.status)) throw badRequest('Unknown status for this project', 'errors.badStatus');
    task.status = body.status;
    if (!isDoneStatus(project, task.status)) task.completedAt = null;
    else task.completedAt ??= new Date();
  }
  if (body.assignee === null) task.assignee = null;
  await task.save();
  if (before.status !== task.status) {
    await logActivity({
      project,
      actor: req.user,
      task,
      type: 'task.updated',
      data: { field: 'status', from: before.status, to: task.status, fromLabel: statusLabel(project, before.status), toLabel: statusLabel(project, task.status) },
    });
  }
  if (before.assignee && !task.assignee) await logActivity({ project, actor: req.user, task, type: 'task.updated', data: { field: 'assignee', from: null, to: null } });
  await logAdmin(req.user, 'task.updated', null, { task: `${project.key}-${task.number}`, title: task.title, ...(body.status !== undefined && { status: task.status }), ...(body.assignee === null && { unassigned: true }) });
  emitProjectChanged(project._id);
  res.json({ task: { _id: task._id, status: task.status, completedAt: task.completedAt, assignee: task.assignee } });
});

router.delete('/tasks/:taskId', async (req, res) => {
  const { task, project } = await loadTask(req.params.taskId);
  await task.deleteOne();
  task.attachments.forEach((file) => destroyFile(file));
  if (task.type === 'epic') await Task.updateMany({ epic: task._id }, { epic: null });
  await Task.updateMany({ project: task.project, blockedBy: task._id }, { $pull: { blockedBy: task._id } });
  await logActivity({ project, actor: req.user, task, type: 'task.deleted' });
  await logAdmin(req.user, 'task.deleted', null, { task: `${project.key}-${task.number}`, title: task.title });
  emitProjectChanged(project._id);
  res.status(204).end();
});

router.get('/audit', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const [total, entries] = await Promise.all([
    AdminLog.countDocuments(),
    AdminLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .lean(),
  ]);
  res.json({ total, page, pages: Math.max(1, Math.ceil(total / 50)), entries });
});

export default router;
