import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';

// Mounted at /api/me (requires auth)
const router = Router();
const DONE_DAYS = 14;

/**
 * Tasks assigned to the current user in all their projects.
 * ?status=open (default): everything not done. ?status=done: done in the last 14 days.
 */
router.get('/tasks', async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id }).select('name key color').lean();
  const filter = { project: { $in: projects.map((p) => p._id) }, assignee: req.user._id };
  if (req.query.status === 'done') {
    filter.status = 'done';
    filter.completedAt = { $gte: new Date(Date.now() - DONE_DAYS * 86400000) };
  } else {
    filter.status = { $ne: 'done' };
  }
  const tasks = await Task.find(filter)
    .select('-comments -description')
    .populate('sprint', 'name status')
    .sort(req.query.status === 'done' ? { completedAt: -1 } : { dueDate: 1, priority: 1, createdAt: 1 })
    .limit(300)
    .lean();
  res.json({ tasks, projects });
});

export default router;
