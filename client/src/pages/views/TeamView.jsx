import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { RoleBadge } from '../../components/ui/Badge';
import { useConfirm } from '../../components/ui/Confirm';
import ProjectFields from '../../components/ProjectFields';
import Tooltip from '../../components/ui/Tooltip';

function InviteForm() {
  const { t } = useTranslation();
  const { addMember } = useProject();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addMember(email.trim(), role);
      toast.success(t('team.added'));
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
          {t('team.inviteButton')}
        </button>
      </div>
    </form>
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
        {canManage && <InviteForm />}
      </div>

      <div className="space-y-4">
        {canManage && <SettingsForm />}
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
