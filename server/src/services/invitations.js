import Invitation from '../models/Invitation.js';
import Project from '../models/Project.js';
import { logActivity } from './activity.js';

/** Adds the user to the project (no-op if already a member). */
export async function addMember(projectId, userId, role) {
  const project = await Project.findById(projectId);
  if (!project) return null;
  if (!project.roleOf(userId)) {
    project.members.push({ user: userId, role });
    await project.save();
  }
  return project;
}

/** Log "X joined the project" (invitation accepted). */
export async function logJoined(project, user) {
  await logActivity({ project, actor: user, type: 'member.joined', data: { name: user.name } });
}

/**
 * Called after sign-up: every pending invitation sent to this email is
 * accepted, so the new user lands directly in the projects they were invited to.
 * Returns the ids of the projects joined.
 */
export async function joinPendingInvitations(user) {
  const invitations = await Invitation.pending({ email: user.email });
  const joined = [];
  for (const invitation of invitations) {
    const project = await addMember(invitation.project, user._id, invitation.role);
    invitation.acceptedAt = new Date();
    await invitation.save();
    if (project) {
      joined.push(String(project._id));
      await logJoined(project, user);
    }
  }
  return joined;
}
