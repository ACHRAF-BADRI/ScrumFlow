import { Router } from 'express';
import Invitation, { hashToken } from '../models/Invitation.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { addMember } from '../services/invitations.js';
import { forbidden, notFound } from '../utils/httpError.js';
import { emitProjectChanged } from '../realtime.js';

// Mounted at /api/invitations (public: the invite link works before sign-up)
const router = Router();

async function findPending(token) {
  const invitation = await Invitation.pending({ tokenHash: hashToken(String(token)) }).findOne().populate('invitedBy', 'name');
  if (!invitation) throw notFound('This invitation is invalid or has expired', 'errors.inviteInvalid');
  const project = await Project.findById(invitation.project).select('name color key');
  if (!project) throw notFound('This invitation is invalid or has expired', 'errors.inviteInvalid');
  return { invitation, project };
}

// What the invite page shows before the person signs up or signs in
router.get('/:token', async (req, res) => {
  const { invitation, project } = await findPending(req.params.token);
  res.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      inviterName: invitation.invitedBy?.name ?? '',
      expiresAt: invitation.expiresAt,
      project: { _id: project._id, name: project.name, color: project.color, key: project.key },
    },
  });
});

// A signed-in user accepts: the invitation must be for their email
router.post('/:token/accept', requireAuth, async (req, res) => {
  const { invitation, project } = await findPending(req.params.token);
  if (invitation.email !== req.user.email) {
    throw forbidden('This invitation was sent to another email address', 'errors.inviteWrongAccount');
  }
  await addMember(project._id, req.user._id, invitation.role);
  invitation.acceptedAt = new Date();
  await invitation.save();
  emitProjectChanged(project._id);
  res.json({ projectId: project._id });
});

export default router;
