import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, LogOut, Mail, RotateCw, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge } from '../../components/ui/Badge';
import { useConfirm } from '../../components/ui/Confirm';
import ProjectFields from '../../components/ProjectFields';
import WorkflowEditor from '../../components/WorkflowEditor';
import Tooltip from '../../components/ui/Tooltip';

function InviteLink({ url, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-xl border border-[#fdab3d]/40 bg-[#fdab3d]/10 p-3">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-xs text-ink">{t('team.emailNotSent')}</p>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label={t('common.close')}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input readOnly className="input h-9 flex-1 font-mono text-xs" value={url} onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy} className="btn-secondary h-9 px-3">
          {copied ? <Check className="h-4 w-4 text-[#00c875]" /> : <Copy className="h-4 w-4" />}
          {copied ? t('team.copied') : t('team.copyLink')}
        </button>
      </div>
    </div>
  );
}

function InviteForm({ onInvited }) {
  const { t } = useTranslation();
  const { addMember } = useProject();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setShareUrl(null);
    try {
      const result = await addMember(email.trim(), role);
      if (result.invited) {
        if (result.emailSent) toast.success(t('team.invitationSent', { email: result.email }));
        else setShareUrl(result.inviteUrl);
        onInvited?.();
      } else {
        toast.success(t('team.added'));
      }
      setEmail('');
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <UserPlus className="h-4 w-4 text-brand" /> {t('team.invite')}
      </h3>
      <p className="mb-3 mt-1 text-xs text-muted">{t('team.inviteHint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" required className="input flex-1" placeholder={t('team.invitePlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input sm:w-36" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">{t('role.member')}</option>
          <option value="admin">{t('role.admin')}</option>
        </select>
        <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
          {saving ? t('common.saving') : t('team.inviteButton')}
        </button>
      </div>
      {shareUrl && <InviteLink url={shareUrl} onClose={() => setShareUrl(null)} />}
    </form>
  );
}

function PendingInvitations({ reloadKey }) {
  const { t } = useTranslation();
  const { listInvitations, revokeInvitation, addMember } = useProject();
  const [invitations, setInvitations] = useState([]);
  const [shareUrl, setShareUrl] = useState(null);

  const load = useCallback(() => listInvitations().then(setInvitations).catch(() => {}), [listInvitations]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (invitations.length === 0) return null;

  const resend = async (invitation) => {
    try {
      const result = await addMember(invitation.email, invitation.role);
      if (result.emailSent) toast.success(t('team.invitationSent', { email: invitation.email }));
      else setShareUrl(result.inviteUrl);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const revoke = async (invitation) => {
    try {
      await revokeInvitation(invitation._id);
      setInvitations((list) => list.filter((i) => i._id !== invitation._id));
      toast.success(t('team.invitationRevoked'));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className="card overflow-hidden">
      <h3 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-bold sm:px-5">
        <Mail className="h-4 w-4 text-brand" /> {t('team.pending')} <span className="text-muted">({invitations.length})</span>
      </h3>
      <ul className="divide-y divide-line">
        {invitations.map((invitation) => (
          <li key={invitation._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{invitation.email}</p>
              <p className="truncate text-xs text-muted">{t('team.expires', { date: formatDate(invitation.expiresAt, { day: 'numeric', month: 'long' }) })}</p>
            </div>
            <RoleBadge role={invitation.role} />
            <Tooltip label={t('team.resend')}>
              <button type="button" className="btn-icon h-8 w-8" onClick={() => resend(invitation)}>
                <RotateCw className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={t('team.revoke')}>
              <button type="button" className="btn-icon h-8 w-8 hover:text-[#e2445c]" onClick={() => revoke(invitation)}>
                <X className="h-4 w-4" />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
      {shareUrl && (
        <div className="px-4 pb-4 sm:px-5">
          <InviteLink url={shareUrl} onClose={() => setShareUrl(null)} />
        </div>
      )}
    </section>
  );
}

function SettingsForm() {
  const { t } = useTranslation();
  const { project, updateProject } = useProject();
  const [form, setForm] = useState(project);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(project), [project]);
  const dirty = ['name', 'key', 'description', 'color'].some((k) => form[k] !== project[k]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProject({ name: form.name, key: form.key, description: form.description, color: form.color });
      toast.success(t('projects.updated'));
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-bold">{t('team.settings')}</h3>
      <ProjectFields value={form} onChange={setForm} />
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn-primary" disabled={!dirty || saving || !form.name.trim()}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

export default function TeamView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { project, members, role, canManage, updateMemberRole, removeMember, deleteProject } = useProject();
  const [invitesKey, setInvitesKey] = useState(0);

  const changeRole = async (memberId, nextRole) => {
    try {
      await updateMemberRole(memberId, nextRole);
      toast.success(t('team.roleUpdated'));
    } catch (err) {
      toastError(err);
    }
  };

  const remove = async (member) => {
    const self = member._id === user._id;
    const ok = await confirm({
      title: self ? t('team.leave') : t('team.remove'),
      message: self ? t('team.leaveConfirm') : t('team.removeConfirm', { name: member.name }),
      danger: true,
      confirmLabel: self ? t('team.leave') : t('team.remove'),
    });
    if (!ok) return;
    try {
      await removeMember(member._id, { self });
      toast.success(self ? t('team.left') : t('team.removed'));
      if (self) navigate('/');
    } catch (err) {
      toastError(err);
    }
  };

  const destroy = async () => {
    const ok = await confirm({ title: t('team.deleteProject'), message: t('team.deleteConfirm', { name: project.name }), danger: true, confirmLabel: t('common.delete') });
    if (!ok) return;
    try {
      await deleteProject();
      toast.success(t('projects.deleted'));
      navigate('/');
    } catch (err) {
      toastError(err);
    }
  };

  const roleOrder = { owner: 0, admin: 1, member: 2 };
  const sorted = [...members].sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <section className="card overflow-hidden">
          <h3 className="border-b border-line px-4 py-3 text-sm font-bold sm:px-5">
            {t('team.members')} <span className="text-muted">({members.length})</span>
          </h3>
          <ul className="divide-y divide-line">
            {sorted.map((m) => {
              const isSelf = m._id === user._id;
              const editable = canManage && m.role !== 'owner' && !isSelf;
              return (
                <li key={m._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar user={m} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.name} {isSelf && <span className="font-normal text-muted">({t('common.you')})</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{m.email}</p>
                  </div>
                  {editable ? (
                    <select className="input h-8 w-auto py-0 text-xs" value={m.role} onChange={(e) => changeRole(m._id, e.target.value)}>
                      <option value="member">{t('role.member')}</option>
                      <option value="admin">{t('role.admin')}</option>
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                  {(editable || (isSelf && m.role !== 'owner')) && (
                    <Tooltip label={isSelf ? t('team.leave') : t('team.remove')}>
                      <button type="button" className="btn-icon h-8 w-8 hover:text-[#e2445c]" onClick={() => remove(m)}>
                        {isSelf ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </Tooltip>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        {canManage && <InviteForm onInvited={() => setInvitesKey((k) => k + 1)} />}
        {canManage && <PendingInvitations reloadKey={invitesKey} />}
      </div>

      <div className="space-y-4">
        {canManage && <SettingsForm />}
        {canManage && <WorkflowEditor />}
        {role === 'owner' && (
          <section className="card border-[#e2445c]/40 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-[#e2445c]">{t('team.dangerZone')}</h3>
            <p className="mb-3 mt-1 text-xs text-muted">{t('team.deleteProjectText')}</p>
            <button type="button" className="btn-danger w-full" onClick={destroy}>
              <Trash2 className="h-4 w-4" /> {t('team.deleteProject')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
