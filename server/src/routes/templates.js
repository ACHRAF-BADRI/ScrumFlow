import { Router } from 'express';
import { REPEAT_FREQUENCIES } from '../models/Project.js';
import { TASK_PRIORITIES, TASK_TYPES } from '../models/Task.js';
import { requireProject } from '../middleware/auth.js';
import { cleanChecklist } from '../services/tasks.js';
import { nextRun } from '../services/recurring.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

// Mounted at /api/projects/:projectId/templates
const router = Router({ mergeParams: true });
const MAX_TEMPLATES = 30;

/** Validated template fields from the request body (all optional on update). */
function readTemplate(req, body, existing = null) {
  const out = {};
  for (const field of ['name', 'title', 'description']) {
    if (body[field] !== undefined) out[field] = String(body[field]).trim();
  }
  const name = out.name ?? existing?.name;
  const title = out.title ?? existing?.title;
  if (!name || !title) throw badRequest('A template needs a name and a task title', 'errors.missingFields');

  if (body.type !== undefined) out.type = TASK_TYPES.includes(body.type) ? body.type : 'task';
  if (body.priority !== undefined) out.priority = TASK_PRIORITIES.includes(body.priority) ? body.priority : 'medium';
  if (body.points !== undefined) out.points = Math.max(0, Math.min(100, Number(body.points) || 0));
  if (body.labels !== undefined) {
    out.labels = [...new Set((Array.isArray(body.labels) ? body.labels : []).map((l) => String(l).trim()).filter(Boolean))].slice(0, 10);
  }
  if (body.checklist !== undefined) out.checklist = cleanChecklist(body.checklist);
  if (body.assignee !== undefined) {
    if (body.assignee && !req.project.roleOf(body.assignee)) throw badRequest('Assignee must be a project member', 'errors.assigneeNotMember');
    out.assignee = body.assignee || null;
  }
  if (body.repeat !== undefined) {
    const r = body.repeat ?? {};
    const repeat = {
      frequency: REPEAT_FREQUENCIES.includes(r.frequency) ? r.frequency : 'none',
      weekday: Math.max(0, Math.min(6, Math.floor(Number(r.weekday ?? 1)) || 0)),
      monthDay: Math.max(1, Math.min(28, Math.floor(Number(r.monthDay ?? 1)) || 1)),
      target: r.target === 'backlog' ? 'backlog' : 'sprint',
      lastRun: existing?.repeat?.lastRun ?? null,
    };
    repeat.nextRun = nextRun(repeat);
    out.repeat = repeat;
  }
  return out;
}

const canEdit = (req, template) => ['owner', 'admin'].includes(req.role) || String(template.createdBy) === String(req.user._id);

router.get('/', requireProject(), (req, res) => {
  res.json({ templates: req.project.templates });
});

router.post('/', requireProject(), async (req, res) => {
  if (req.project.templates.length >= MAX_TEMPLATES) throw badRequest('Too many templates', 'errors.tooManyTemplates');
  const data = readTemplate(req, req.body || {});
  req.project.templates.push({ ...data, createdBy: req.user._id });
  await req.project.save();
  res.status(201).json({ template: req.project.templates.at(-1), templates: req.project.templates });
});

router.patch('/:templateId', requireProject(), async (req, res) => {
  const template = req.project.templates.id(req.params.templateId);
  if (!template) throw notFound('Template not found', 'errors.notFound');
  if (!canEdit(req, template)) throw forbidden();
  Object.assign(template, readTemplate(req, req.body || {}, template.toObject()));
  await req.project.save();
  res.json({ template, templates: req.project.templates });
});

router.delete('/:templateId', requireProject(), async (req, res) => {
  const template = req.project.templates.id(req.params.templateId);
  if (!template) throw notFound('Template not found', 'errors.notFound');
  if (!canEdit(req, template)) throw forbidden();
  template.deleteOne();
  await req.project.save();
  res.json({ templates: req.project.templates });
});

export default router;
