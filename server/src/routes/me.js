import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import mongoose from 'mongoose';
import { statusesOf } from '../utils/statuses.js';
import { badRequest, notFound } from '../utils/httpError.js';

// Mounted at /api/me (requires auth)
const router = Router();
const DONE_DAYS = 14;

/**
 * Tasks assigned to the current user in all their projects.
 * ?status=open (default): everything not done. ?status=done: done in the last 14 days.
 */
router.get('/tasks', async (req, res) => {
  const found = await Project.find({ 'members.user': req.user._id }).select('name key color statuses').lean();
  const projects = found.map((p) => ({ ...p, statuses: statusesOf(p) }));
  const filter = { project: { $in: projects.map((p) => p._id) }, assignee: req.user._id };
  if (req.query.status === 'done') {
    filter.completedAt = { $gte: new Date(Date.now() - DONE_DAYS * 86400000) };
  } else {
    filter.completedAt = null; // matches null and missing
  }
  const tasks = await Task.find(filter)
    .select('-comments -description')
    .populate('sprint', 'name status')
    .sort(req.query.status === 'done' ? { completedAt: -1 } : { dueDate: 1, priority: 1, createdAt: 1 })
    .limit(300)
    .lean();
  res.json({ tasks, projects });
});

// ---- Saved filters ("views"), per project ------------------------------------

const FILTER_KEYS = ['search', 'assignee', 'epic', 'priority', 'type', 'label'];
const cleanFilters = (input = {}) =>
  Object.fromEntries(
    FILTER_KEYS.filter((k) => input?.[k] !== undefined && input[k] !== null && input[k] !== '').map((k) => [k, String(input[k]).slice(0, 100)])
  );
const filtersOf = (user, project) => user.savedFilters.filter((f) => String(f.project) === String(project));

router.get('/filters', (req, res) => {
  res.json({ filters: filtersOf(req.user, req.query.project ?? '') });
});

router.post('/filters', async (req, res) => {
  const { project, name, filters } = req.body || {};
  if (!name?.trim() || !mongoose.isValidObjectId(project)) throw badRequest('A name is required', 'errors.missingFields');
  const member = await Project.exists({ _id: project, 'members.user': req.user._id });
  if (!member) throw notFound('Project not found', 'errors.projectNotFound');
  if (filtersOf(req.user, project).length >= 20) throw badRequest('Too many saved filters', 'errors.tooManyFilters');
  req.user.savedFilters.push({ project, name: name.trim().slice(0, 40), filters: cleanFilters(filters) });
  await req.user.save();
  res.status(201).json({ filters: filtersOf(req.user, project) });
});

router.delete('/filters/:filterId', async (req, res) => {
  const saved = req.user.savedFilters.id(req.params.filterId);
  if (!saved) throw notFound('Filter not found', 'errors.notFound');
  const { project } = saved;
  saved.deleteOne();
  await req.user.save();
  res.json({ filters: filtersOf(req.user, project) });
});

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Command palette search: tasks by title or key (e.g. "APO-12"), and projects by name. */
router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const projects = await Project.find({ 'members.user': req.user._id }).select('name key color').lean();
  if (!q) return res.json({ tasks: [], projects: projects.slice(0, 8) });

  const re = new RegExp(escapeRegExp(q), 'i');
  const or = [{ title: re }];
  const keyMatch = q.match(/^([a-z0-9]{1,6})-(\d+)$/i);
  if (keyMatch) {
    const project = projects.find((p) => p.key.toLowerCase() === keyMatch[1].toLowerCase());
    if (project) or.push({ project: project._id, number: Number(keyMatch[2]) });
  }
  const tasks = await Task.find({ project: { $in: projects.map((p) => p._id) }, $or: or })
    .select('title number type status project completedAt')
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();
  res.json({
    tasks,
    projects: projects.filter((p) => re.test(p.name) || re.test(p.key)).slice(0, 6),
    allProjects: projects,
  });
});

export default router;
