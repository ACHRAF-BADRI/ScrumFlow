import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Ban, KeyRound, Pencil, RotateCcw, ShieldCheck, ShieldOff, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { resolveStatuses } from '../../hooks/useStatuses';
import { formatDate, formatDateTime, relativeTime } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { Badge, RoleBadge, TypeIcon } from '../../components/ui/Badge';
import { EmptyState, PageLoader } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Modal';
import { useConfirm } from '../../components/ui/Confirm';
import ActivityItem from '../../components/activity/ActivityItem';
import { AdminBadges } from './AdminPage';

function EditModal({ open, onClose, user, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', language: 'en', password: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: user.name, email: user.email, language: user.language ?? 'en', password: '' });
  }, [open, user]);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: form.name, language: form.language };
      if (!user.isRootAdmin) payload.email = form.email;
      if (form.password && !user.isRootAdmin) payload.password = form.password;
      const { data } = await api.patch(`/admin/users/${user._id}`, payload);
      toast.success(t('admin.saved'));
      onSaved(data.user);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admin.editUser')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="admin-edit" className="btn-primary" disabled={busy}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="admin-edit" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">{t('auth.name')}</span>
          <input className="input" value={form.name} onChange={set('name')} required maxLength={60} />
        </label>
        <label className="block">
          <span className="label">{t('auth.email')}</span>
          <input className="input" type="email" value={form.email} onChange={set('email')} required disabled={user.isRootAdmin} />
        </label>
        <label className="block">
          <span className="label">{t('nav.language')}</span>
          <select className="input" value={form.language} onChange={set('language')}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        {user.isRootAdmin ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t('admin.rootManaged')}</p>
        ) : (
          <label className="block">
            <span className="label flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> {t('admin.newPassword')}
            </span>
            <input className="input" type="text" value={form.password} onChange={set('password')} minLength={6} placeholder={t('admin.newPasswordHint')} autoComplete="new-password" />
          </label>
        )}
      </form>
    </Modal>
  );
}

function TaskRow({ task, onChange, onDelete }) {
  const { t } = useTranslation();
  const statuses = useMemo(() => resolveStatuses(task.statuses, t), [task.statuses, t]);
  const current = statuses.find((s) => s.key === task.status);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
      <TypeIcon type={task.type} className="h-4 w-4 shrink-0" />
      <span className="shrink-0 font-mono text-[11px] font-semibold text-muted">{task.key}</span>
      <span className={clsx('min-w-[8rem] flex-1 truncate', task.completedAt && 'text-muted line-through')} title={task.title}>
        {task.title}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: task.projectColor }} />
        {task.projectName}
        {task.sprintName && ` · ${task.sprintName}`}
      </span>
      {task.role === 'reporter' && <Badge color="#a1a3b8">{t('admin.reporter')}</Badge>}
      <select
        className="input h-8 w-auto py-0 text-xs font-semibold"
        style={{ color: current?.color }}
        value={task.status}
        onChange={(e) => onChange(task, e.target.value)}
        aria-label={t('task.status')}
      >
        {statuses.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn-icon h-8 w-8 hover:text-[#e2445c]" onClick={() => onDelete(task)} aria-label={t('common.delete')}>
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

/** One user, seen by an admin: profile, projects, tasks, recent activity, and actions. */
export default function AdminUserPage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [taskFilter, setTaskFilter] = useState('open');

  const load = useCallback(
    () =>
      api
        .get(`/admin/users/${userId}`)
        .then(({ data: body }) => setData(body))
        .catch(setError),
    [userId]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState illustration="notFound" title={errorMessage(error)} action={<Link to="/admin" className="btn-primary">{t('common.back')}</Link>} />;
  if (!data) return <PageLoader />;
  const { user, projects, tasks, activity } = data;
  const self = user._id === me._id;
  const protectedUser = user.isRootAdmin || (user.isAdmin && !me.isRootAdmin && !self);

  const patch = async (changes, message) => {
    try {
      const { data: body } = await api.patch(`/admin/users/${user._id}`, changes);
      setData((d) => ({ ...d, user: body.user }));
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleSuspend = async () => {
    if (!user.suspended) {
      const ok = await confirm({ title: t('admin.suspend'), message: t('admin.suspendConfirm', { name: user.name }), danger: true, confirmLabel: t('admin.suspend') });
      if (!ok) return;
    }
    patch({ suspended: !user.suspended }, user.suspended ? t('admin.restoredToast') : t('admin.suspendedToast'));
  };

  const toggleAdmin = async () => {
    const ok = await confirm({
      title: user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin'),
      message: user.isAdmin ? t('admin.removeAdminConfirm', { name: user.name }) : t('admin.makeAdminConfirm', { name: user.name }),
      confirmLabel: user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin'),
      danger: !user.isAdmin,
    });
    if (ok) patch({ isAdmin: !user.isAdmin }, t('admin.saved'));
  };

  const removeUser = async () => {
    try {
      const { data: body } = await api.delete(`/admin/users/${user._id}`);
      toast.success(t('admin.deletedToast', { name: user.name, deleted: body.deleted, transferred: body.transferred }));
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changeStatus = async (task, status) => {
    try {
      const { data: body } = await api.patch(`/admin/tasks/${task._id}`, { status });
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x._id === task._id ? { ...x, ...body.task } : x)) }));
      toast.success(t('admin.taskUpdated', { key: task.key }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteTask = async (task) => {
    const ok = await confirm({ title: t('common.delete'), message: t('admin.deleteTaskConfirm', { key: task.key, title: task.title }), danger: true, confirmLabel: t('common.delete') });
    if (!ok) return;
    try {
      await api.delete(`/admin/tasks/${task._id}`);
      setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x._id !== task._id) }));
      toast.success(t('task.deleted'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const shown = tasks.filter((x) => (taskFilter === 'open' ? !x.completedAt : taskFilter === 'done' ? x.completedAt : true));

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> {t('admin.title')}
      </Link>

      <section className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Avatar user={user} size="lg" className="!h-14 !w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
            {user.name} <AdminBadges user={user} />
          </h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-muted">
            {t('admin.joined', { date: formatDate(user.createdAt, { day: 'numeric', month: 'long', year: 'numeric' }) })} · {t('admin.lastLogin')}:{' '}
            {user.lastLoginAt ? relativeTime(user.lastLoginAt) : t('admin.never')}
            {user.twoFactor && ` · ${t('admin.twoFactorOn')}`}
            {user.oauth.length > 0 && ` · ${user.oauth.join(', ')}`}
          </p>
        </div>
        {!protectedUser && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)} data-testid="admin-edit">
              <Pencil className="h-4 w-4" /> {t('common.edit')}
            </button>
            {!self && (
              <button type="button" className={clsx('btn-secondary', !user.suspended && 'hover:text-[#fdab3d]')} onClick={toggleSuspend} data-testid="admin-suspend">
                {user.suspended ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />} {user.suspended ? t('admin.restore') : t('admin.suspend')}
              </button>
            )}
            {me.isRootAdmin && !self && (
              <button type="button" className="btn-secondary" onClick={toggleAdmin} data-testid="admin-toggle-admin">
                {user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} {user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
              </button>
            )}
            {!self && (
              <button type="button" className="btn-danger" onClick={() => (setConfirmText(''), setDeleting(true))} data-testid="admin-delete">
                <Trash2 className="h-4 w-4" /> {t('common.delete')}
              </button>
            )}
          </div>
        )}
        {protectedUser && <p className="w-full text-xs text-muted">{user.isRootAdmin ? t('admin.rootProtected') : t('admin.adminProtected')}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="flex-1 text-sm font-bold">
              {t('admin.tasks')} <span className="text-muted">({tasks.length})</span>
            </h2>
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {['open', 'done', 'all'].map((f) => (
                <button key={f} type="button" onClick={() => setTaskFilter(f)} className={clsx('rounded-md px-2.5 py-1 text-xs font-semibold', taskFilter === f ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                  {t(`admin.taskFilter.${f}`)}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t('admin.noTasks')}</p>
          ) : (
            <ul className="divide-y divide-line" data-testid="admin-tasks">
              {shown.map((task) => (
                <TaskRow key={task._id} task={task} onChange={changeStatus} onDelete={deleteTask} />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-bold">
              {t('admin.projects')} <span className="text-muted">({projects.length})</span>
            </h2>
            {projects.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t('admin.noProjects')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {projects.map((p) => (
                  <li key={p._id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold text-white" style={{ background: p.color }}>
                      {p.key.slice(0, 3)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">{t('admin.membersCount', { count: p.members })}</span>
                    <RoleBadge role={p.role} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold">{t('admin.recentActivity')}</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">{t('admin.noActivity')}</p>
            ) : (
              <ol className="space-y-3">
                {activity.slice(0, 15).map((a) => (
                  <li key={a._id}>
                    <ActivityItem activity={{ ...a, actor: { name: user.name, avatarColor: user.avatarColor } }} compact />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <EditModal open={editing} onClose={() => setEditing(false)} user={user} onSaved={(u) => setData((d) => ({ ...d, user: u }))} />
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t('admin.deleteUser')}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-danger" disabled={confirmText.trim().toLowerCase() !== user.email} onClick={removeUser} data-testid="admin-delete-confirm">
              {t('admin.deleteForever')}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>{t('admin.deleteText', { name: user.name })}</p>
          <label className="block">
            <span className="label normal-case tracking-normal">
              {t('admin.typeEmail')} <b className="text-ink">{user.email}</b>
            </span>
            <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={user.email} autoFocus />
          </label>
        </div>
      </Modal>
      <p className="text-center text-[11px] text-muted" title={formatDateTime(new Date())}>
        <RotateCcw className="mr-1 inline h-3 w-3" />
        <button type="button" className="hover:text-brand" onClick={load}>
          {t('admin.refresh')}
        </button>
      </p>
    </div>
  );
}
