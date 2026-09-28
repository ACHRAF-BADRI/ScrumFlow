import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import { logActivity } from './activity.js';
import { createTaskRecord } from './tasks.js';
import { emitProjectChanged } from '../realtime.js';

// Recurring tasks are created at 06:00 UTC on their day
const RUN_HOUR_UTC = 6;
const DAY = 24 * 60 * 60 * 1000;

/** Next time a repeat rule fires, strictly after `from`. */
export function nextRun(repeat, from = new Date()) {
  if (!repeat || repeat.frequency === 'none') return null;
  const at = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), RUN_HOUR_UTC));
  let candidate = at(from);
  if (repeat.frequency === 'daily') {
    if (candidate <= from) candidate = new Date(candidate.getTime() + DAY);
    return candidate;
  }
  if (repeat.frequency === 'weekly') {
    const weekday = repeat.weekday ?? 1;
    let add = (weekday - candidate.getUTCDay() + 7) % 7;
    if (add === 0 && candidate <= from) add = 7;
    return new Date(candidate.getTime() + add * DAY);
  }
  // monthly: days 1 to 28 exist in every month
  const day = repeat.monthDay ?? 1;
  candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day, RUN_HOUR_UTC));
  if (candidate <= from) candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day, RUN_HOUR_UTC));
  return candidate;
}

const ROBOT = { _id: null, name: 'ScrumFlow' };

/**
 * Creates the tasks of every template that is due. A server that slept
 * through several occurrences (free hosting) creates one task, not a pile of
 * copies. Returns the number of tasks created.
 */
export async function runRecurring(now = new Date()) {
  const projects = await Project.find({ 'templates.repeat.nextRun': { $lte: now } });
  let created = 0;
  for (const project of projects) {
    const active = await Sprint.findOne({ project: project._id, status: 'active' }).select('_id').lean();
    for (const template of project.templates) {
      const { repeat } = template;
      if (repeat.frequency === 'none' || !repeat.nextRun || repeat.nextRun > now) continue;
      const assignee = template.assignee && project.roleOf(template.assignee) ? template.assignee : null;
      const task = await createTaskRecord({
        project,
        reporterId: template.createdBy,
        data: {
          title: template.title,
          description: template.description,
          type: template.type,
          priority: template.priority,
          points: template.points,
          labels: template.labels,
          checklist: template.checklist,
          assignee,
          sprint: repeat.target === 'sprint' && active ? active._id : null,
        },
      });
      await logActivity({ project, actor: ROBOT, task, type: 'task.recurring', data: { template: template.name } });
      repeat.lastRun = now;
      repeat.nextRun = nextRun(repeat, now);
      created += 1;
    }
    // createTaskRecord changed the counter in the database: only write the templates back
    await Project.updateOne({ _id: project._id }, { $set: { templates: project.templates } });
    emitProjectChanged(project._id);
  }
  return created;
}

/** Checks every 15 minutes while the server is awake. */
export function startRecurringJob() {
  const tick = () => runRecurring().catch((err) => console.warn('[recurring]', err.message));
  tick();
  return setInterval(tick, 15 * 60 * 1000);
}
