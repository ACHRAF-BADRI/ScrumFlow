import { Router } from 'express';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import { hasStatus, isDoneStatus, statusLabel } from '../utils/statuses.js';
import { cleanChecklist, createTaskRecord } from '../services/tasks.js';
import { MAX_FILE_SIZE, attachmentsEnabled, destroyFile, isOwnUpload, uploadSignature } from '../services/cloudinary.js';
import { isValidId, requireProject } from '../middleware/auth.js';
import { HttpError, badRequest, forbidden, notFound, pick } from '../utils/httpError.js';
import { notifyAssigned, notifyMentions } from '../services/notify.js';
import { logActivity, logTaskChanges } from '../services/activity.js';
import Activity from '../models/Activity.js';

// Mounted at /api/projects/:projectId/tasks
const router = Router({ mergeParams: true });
const EDITABLE = ['title', 'description', 'type', 'status', 'priority', 'points', 'assignee', 'sprint', 'epic', 'dueDate', 'labels', 'order', 'blockedBy'];
const USER_FIELDS = 'name email avatarColor';

const withRefs = (query) =>
  query
    .populate('assignee', USER_FIELDS)
    .populate('reporter', USER_FIELDS)
    .populate('comments.author', USER_FIELDS)
    .populate('attachments.uploadedBy', 'name avatarColor');

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
  if (data.epic === '') data.epic = null;
  if (data.epic) {
    if (!isValidId(data.epic)) throw badRequest('Invalid epic', 'errors.badRequest');
    const epic = await Task.findOne({ _id: data.epic, project: req.project._id }).select('type').lean();
    if (!epic || epic.type !== 'epic') throw badRequest('The parent must be an epic of this project', 'errors.badEpic');
    if (String(data.epic) === String(req.params.taskId)) throw badRequest('A task cannot be its own epic', 'errors.badEpic');
  }
  if (data.status !== undefined && !hasStatus(req.project, data.status)) {
    throw badRequest('Unknown status for this project', 'errors.badStatus');
  }
  if (data.blockedBy !== undefined) data.blockedBy = await validateBlockers(req, data.blockedBy);
  if (Array.isArray(data.labels)) {
    data.labels = [...new Set(data.labels.map((l) => String(l).trim()).filter(Boolean))].slice(0, 10);
  }
  return data;
}

/**
 * "Blocked by" links: tasks of the same project, never the task itself, and
 * no loop (A waits for B which waits for A).
 */
async function validateBlockers(req, input) {
  if (!Array.isArray(input)) throw badRequest('blockedBy must be an array', 'errors.badRequest');
  const ids = [...new Set(input.map(String))].filter(isValidId).slice(0, 20);
  const self = req.params.taskId ? String(req.params.taskId) : null;
  if (self && ids.includes(self)) throw badRequest('A task cannot block itself', 'errors.badBlocker');
  if (!ids.length) return [];

  const all = await Task.find({ project: req.project._id }).select('blockedBy').lean();
  const graph = new Map(all.map((t) => [String(t._id), (t.blockedBy ?? []).map(String)]));
  if (ids.some((id) => !graph.has(id))) throw badRequest('Blockers must be tasks of this project', 'errors.badBlocker');
  if (self) {
    // Walk down from the new blockers: reaching this task again means a loop
    const seen = new Set();
    const stack = [...ids];
    while (stack.length) {
      const id = stack.pop();
      if (id === self) throw badRequest('This link would create a loop', 'errors.blockerLoop');
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(graph.get(id) ?? []));
    }
  }
  return ids;
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
  // A template can bring its checklist along
  data.checklist = cleanChecklist(req.body.checklist);
  const task = await createTaskRecord({ project: req.project, data, reporterId: req.user._id });
  notifyAssigned({ actor: req.user, project: req.project, task, assigneeId: task.assignee }).catch(() => {});
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.created' });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

// Bulk position update after a drag & drop: [{ id, status?, sprint?, order }]
router.post('/reorder', requireProject(), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
  const withStatus = items.filter((i) => i.status !== undefined && isValidId(i.id));
  const before = withStatus.length
    ? await Task.find({ _id: { $in: withStatus.map((i) => i.id) }, project: req.project._id }).select('status number title')
    : [];
  const ops = [];
  for (const item of items) {
    if (!isValidId(item.id)) continue;
    const update = [{ $set: { order: Number(item.order) || 0 } }];
    if (item.status !== undefined) {
      if (!hasStatus(req.project, item.status)) throw badRequest('Unknown status for this project', 'errors.badStatus');
      // Keep the original completion date of tasks that were already done (burndown accuracy)
      const completedAt = isDoneStatus(req.project, item.status) ? { $ifNull: ['$completedAt', new Date()] } : null;
      update.push({ $set: { status: item.status, completedAt } });
    }
    ops.push({ updateOne: { filter: { _id: item.id, project: req.project._id }, update } });
  }
  if (ops.length) await Task.bulkWrite(ops);
  for (const task of before) {
    const next = withStatus.find((i) => String(i.id) === String(task._id))?.status;
    if (next && next !== task.status) {
      await logActivity({
        project: req.project,
        actor: req.user,
        task,
        type: 'task.updated',
        data: { field: 'status', from: task.status, to: next, fromLabel: statusLabel(req.project, task.status), toLabel: statusLabel(req.project, next) },
      });
    }
  }
  res.json({ updated: ops.length });
});

router.get('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.patch('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const data = await validateRefs(req, pick(req.body, EDITABLE));
  const previousAssignee = task.assignee ? String(task.assignee) : null;
  const before = task.toObject();
  Object.assign(task, data);
  if (task.type === 'epic') task.epic = null;
  if ('status' in data) {
    if (!isDoneStatus(req.project, task.status)) task.completedAt = null;
    else if (!task.completedAt) task.completedAt = new Date();
  }
  await task.save();
  if (before.type === 'epic' && task.type !== 'epic') await Task.updateMany({ epic: task._id }, { epic: null });
  await logTaskChanges({ project: req.project, actor: req.user, before, after: task });
  if ('assignee' in data && data.assignee && String(data.assignee) !== previousAssignee) {
    notifyAssigned({ actor: req.user, project: req.project, task, assigneeId: data.assignee }).catch(() => {});
  }
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const canDelete = ['owner', 'admin'].includes(req.role) || String(task.reporter) === String(req.user._id);
  if (!canDelete) throw forbidden('Only the reporter or a project admin can delete this task', 'errors.forbidden');
  await task.deleteOne();
  task.attachments.forEach((file) => destroyFile(file));
  if (task.type === 'epic') await Task.updateMany({ epic: task._id }, { epic: null });
  await Task.updateMany({ project: req.project._id, blockedBy: task._id }, { $pull: { blockedBy: task._id } });
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.deleted' });
  res.status(204).end();
});

router.post('/:taskId/comments', requireProject(), async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) throw badRequest('Comment cannot be empty', 'errors.missingFields');
  const task = await loadTask(req);
  task.comments.push({ author: req.user._id, text });
  await task.save();
  notifyMentions({ actor: req.user, project: req.project, task, text }).catch(() => {});
  await logActivity({ project: req.project, actor: req.user, task, type: 'task.commented', data: { excerpt: text.slice(0, 140) } });
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

// ---- Checklist (subtasks) ----------------------------------------------------

router.post('/:taskId/checklist', requireProject(), async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) throw badRequest('Checklist item cannot be empty', 'errors.missingFields');
  const task = await loadTask(req);
  if (task.checklist.length >= 50) throw badRequest('Too many checklist items', 'errors.badRequest');
  task.checklist.push({ text: text.slice(0, 200) });
  await task.save();
  await logActivity({ project: req.project, actor: req.user, task, type: 'checklist.added', data: { text } });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)) });
});

router.patch('/:taskId/checklist/:itemId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const item = task.checklist.id(req.params.itemId);
  if (!item) throw notFound('Checklist item not found', 'errors.notFound');
  if (req.body?.text !== undefined) {
    const text = String(req.body.text).trim();
    if (!text) throw badRequest('Checklist item cannot be empty', 'errors.missingFields');
    item.text = text.slice(0, 200);
  }
  const toggled = req.body?.done !== undefined && Boolean(req.body.done) !== item.done;
  if (toggled) {
    item.done = Boolean(req.body.done);
    item.doneAt = item.done ? new Date() : null;
  }
  await task.save();
  if (toggled) {
    await logActivity({ project: req.project, actor: req.user, task, type: item.done ? 'checklist.checked' : 'checklist.unchecked', data: { text: item.text } });
  }
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

router.delete('/:taskId/checklist/:itemId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const item = task.checklist.id(req.params.itemId);
  if (!item) throw notFound('Checklist item not found', 'errors.notFound');
  item.deleteOne();
  await task.save();
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

// ---- Attachments (files on Cloudinary) ---------------------------------------

const MAX_ATTACHMENTS = 20;
const RESOURCE_TYPES = ['image', 'video', 'raw'];

function assertAttachments() {
  if (!attachmentsEnabled()) throw new HttpError(503, 'File uploads are not configured on this server', 'errors.attachmentsDisabled');
}

// Signature for one direct upload from the browser to Cloudinary
router.post('/:taskId/attachments/sign', requireProject(), async (req, res) => {
  assertAttachments();
  const task = await loadTask(req);
  if (task.attachments.length >= MAX_ATTACHMENTS) throw badRequest('Too many attachments', 'errors.tooManyAttachments');
  res.json({ ...uploadSignature(req.project._id), maxSize: MAX_FILE_SIZE });
});

// Saves the uploaded file on the task
router.post('/:taskId/attachments', requireProject(), async (req, res) => {
  assertAttachments();
  const task = await loadTask(req);
  const { url, publicId, name, size, mime, resourceType } = req.body || {};
  if (!isOwnUpload(req.project._id, { url, publicId })) throw badRequest('Unknown file', 'errors.badAttachment');
  if (Number(size) > MAX_FILE_SIZE) throw badRequest('File too large', 'errors.fileTooLarge');
  if (task.attachments.length >= MAX_ATTACHMENTS) throw badRequest('Too many attachments', 'errors.tooManyAttachments');
  task.attachments.push({
    url,
    publicId,
    name: String(name || 'file').slice(0, 200),
    size: Number(size) || 0,
    mime: String(mime ?? '').slice(0, 120),
    resourceType: RESOURCE_TYPES.includes(resourceType) ? resourceType : 'raw',
    uploadedBy: req.user._id,
  });
  await task.save();
  await logActivity({ project: req.project, actor: req.user, task, type: 'attachment.added', data: { name: String(name || 'file').slice(0, 200) } });
  res.status(201).json({ task: await withRefs(Task.findById(task._id)), attachment: task.attachments.at(-1) });
});

router.delete('/:taskId/attachments/:attachmentId', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const file = task.attachments.id(req.params.attachmentId);
  if (!file) throw notFound('Attachment not found', 'errors.notFound');
  const canDelete = String(file.uploadedBy) === String(req.user._id) || ['owner', 'admin'].includes(req.role);
  if (!canDelete) throw forbidden();
  const { publicId, resourceType } = file;
  file.deleteOne();
  await task.save();
  destroyFile({ publicId, resourceType });
  res.json({ task: await withRefs(Task.findById(task._id)) });
});

// History of one task (task drawer)
router.get('/:taskId/activity', requireProject(), async (req, res) => {
  const task = await loadTask(req);
  const activity = await Activity.find({ task: task._id }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name avatarColor');
  res.json({ activity });
});

export default router;
