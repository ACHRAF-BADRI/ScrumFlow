import User from '../models/User.js';
import { mentionEmail, taskAssignedEmail } from '../emails/templates.js';
import { appUrl, sendInBackground } from '../utils/mailer.js';

const RECIPIENT_FIELDS = 'name email language emailNotifications';
const taskUrl = (project, task) => appUrl(`/projects/${project._id}?task=${task._id}`);
const taskKey = (project, task) => `${project.key}-${task.number}`;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Email the new assignee (not when you assign yourself, or when they opted out). */
export async function notifyAssigned({ actor, project, task, assigneeId }) {
  if (!assigneeId || String(assigneeId) === String(actor._id)) return;
  const assignee = await User.findById(assigneeId).select(RECIPIENT_FIELDS);
  if (!assignee || !assignee.emailNotifications) return;
  sendInBackground(
    taskAssignedEmail({
      to: assignee.email,
      lang: assignee.language,
      actorName: actor.name,
      projectName: project.name,
      taskKey: taskKey(project, task),
      taskTitle: task.title,
      url: taskUrl(project, task),
    })
  );
}

/**
 * Finds project members mentioned as "@Full Name" or "@FirstName" in a comment
 * (the comment box inserts "@Full Name" from its suggestions).
 */
export async function findMentioned(project, text, authorId) {
  const memberIds = project.members.map((m) => m.user).filter((id) => String(id) !== String(authorId));
  if (!memberIds.length || !text.includes('@')) return [];
  const members = await User.find({ _id: { $in: memberIds } }).select(RECIPIENT_FIELDS);
  return members.filter((member) => {
    const names = [member.name, member.name.split(/\s+/)[0]].filter(Boolean);
    return names.some((name) => new RegExp(`(^|\\s)@${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'iu').test(text));
  });
}

export async function notifyMentions({ actor, project, task, text }) {
  const mentioned = await findMentioned(project, text, actor._id);
  const excerpt = text.length > 280 ? `${text.slice(0, 277)}...` : text;
  for (const member of mentioned) {
    if (!member.emailNotifications) continue;
    sendInBackground(
      mentionEmail({
        to: member.email,
        lang: member.language,
        actorName: actor.name,
        projectName: project.name,
        taskKey: taskKey(project, task),
        taskTitle: task.title,
        excerpt,
        url: taskUrl(project, task),
      })
    );
  }
}
