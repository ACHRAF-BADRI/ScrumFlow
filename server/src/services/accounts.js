import Invitation from '../models/Invitation.js';
import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import User from '../models/User.js';

/**
 * Deletes an account. Owned projects shared with others are handed over to an
 * admin (or the oldest member); projects the user is alone in are deleted
 * with their sprints and tasks. Used by "delete my account" and by admins.
 */
export async function deleteUserAccount(userId) {
  const projects = await Project.find({ 'members.user': userId });
  let transferred = 0;
  let deleted = 0;
  for (const project of projects) {
    const others = project.members.filter((m) => String(m.user) !== String(userId));
    if (String(project.owner) === String(userId)) {
      if (others.length === 0) {
        await Promise.all([Task.deleteMany({ project: project._id }), Sprint.deleteMany({ project: project._id })]);
        await project.deleteOne();
        deleted += 1;
        continue;
      }
      const heir = others.find((m) => m.role === 'admin') ?? others[0];
      heir.role = 'owner';
      project.owner = heir.user;
      transferred += 1;
    }
    project.members = others;
    await project.save();
  }
  // Their open work becomes unassigned instead of pointing at a deleted account
  await Task.updateMany({ assignee: userId }, { assignee: null });
  await Invitation.deleteMany({ invitedBy: userId, acceptedAt: null });
  await Notification.deleteMany({ user: userId });
  await User.deleteOne({ _id: userId });
  return { transferred, deleted };
}
