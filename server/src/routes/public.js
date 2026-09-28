import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import { statusesOf } from '../utils/statuses.js';
import { notFound } from '../utils/httpError.js';

// Mounted at /api/public, no account needed
const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

/**
 * Read-only board for people with the link: the active sprint (or the open
 * backlog when no sprint runs). Only what the board shows: no emails, no
 * comments, no files.
 */
router.get('/:token', limiter, async (req, res) => {
  const token = String(req.params.token);
  if (token.length < 20) throw notFound('Link not found', 'errors.shareNotFound');
  const project = await Project.findOne({ shareToken: token }).select('name key color description statuses').lean();
  if (!project) throw notFound('Link not found', 'errors.shareNotFound');

  const sprint = await Sprint.findOne({ project: project._id, status: 'active' }).select('name goal startDate endDate').lean();
  const filter = sprint ? { project: project._id, sprint: sprint._id } : { project: project._id, sprint: null, completedAt: null };
  const tasks = await Task.find(filter)
    .select('number title type status priority points labels dueDate completedAt assignee order')
    .populate('assignee', 'name avatarColor')
    .sort({ order: 1 })
    .limit(300)
    .lean();
  res.json({ project: { ...project, _id: undefined, statuses: statusesOf(project) }, sprint, tasks });
});

export default router;
