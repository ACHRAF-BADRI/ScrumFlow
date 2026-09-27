import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { notFound } from '../utils/httpError.js';

// Mounted at /api/notifications (requires auth)
const router = Router();
const LIMIT = 30;

export const populateNotification = (query) => query.populate('actor', 'name avatarColor');

router.get('/', async (req, res) => {
  const [notifications, unread] = await Promise.all([
    populateNotification(Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(LIMIT)),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ notifications, unread });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ unread: 0 });
});

router.patch('/:id/read', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Notification not found', 'errors.notFound');
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!notification) throw notFound('Notification not found', 'errors.notFound');
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ unread });
});

export default router;
