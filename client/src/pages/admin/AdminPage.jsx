import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, ChevronLeft, ChevronRight, FolderKanban, ListTodo, Search, ShieldCheck, UserPlus, Users, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatDateTime, relativeTime } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';

export function AdminBadges({ user }) {
  const { t } = useTranslation();
  return (
    <>
      {user.isRootAdmin && <Badge color="#a25ddc">{t('admin.mainAdmin')}</Badge>}
      {user.isAdmin && !user.isRootAdmin && <Badge color="#6161ff">{t('admin.admin')}</Badge>}
      {user.suspended && <Badge color="#e2445c">{t('admin.suspended')}</Badge>}
    </>
  );
}

function Stat({ icon: Icon, color, label, value, hint }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11" style={{ background: `${color}1f`, color }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-2xl font-extrabold leading-tight">{value ?? '…'}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function CreateUserModal({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', language: 'en', isAdmin: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: '', email: '', password: '', language: 'en', isAdmin: false });
  }, [open]);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/admin/users', form);
      toast.success(t('admin.userCreated', { name: data.user.name }));
      onCreated(data.user);
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
      title={t('admin.addUser')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="admin-create" className="btn-primary" disabled={busy}>
            {t('common.create')}
          </button>
        </>
      }
    >
      <form id="admin-create" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">{t('auth.name')}</span>
          <input className="input" value={form.name} onChange={set('name')} required maxLength={60} autoFocus />
        </label>
        <label className="block">
          <span className="label">{t('auth.email')}</span>
          <input className="input" type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label className="block">
          <span className="label">{t('admin.tempPassword')}</span>
          <input className="input" type="text" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" />
          <span className="mt-1 block text-[11px] text-muted">{t('admin.tempPasswordHint')}</span>
        </label>
        <label className="block">
          <span className="label">{t('nav.language')}</span>
          <select className="input" value={form.language} onChange={set('language')}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        {me.isRootAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[#6161ff]" checked={form.isAdmin} onChange={set('isAdmin')} />
            {t('admin.giveAdmin')}
          </label>
        )}
      </form>
    </Modal>
  );
}

const ACTION_COLORS = { 'user.deleted': '#e2445c', 'user.suspended': '#fdab3d', 'task.deleted': '#e2445c', 'admin.granted': '#a25ddc', 'admin.revoked': '#a25ddc' };

function Audit() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => {
    api
      .get('/admin/audit', { params: { page } })
      .then(({ data: body }) => setData(body))
      .catch((err) => toast.error(errorMessage(err)));
  }, [page]);
  if (!data) return <Skeleton className="h-64" />;
  if (!data.entries.length) return <EmptyState compact illustration="history" title={t('admin.auditEmpty')} />;

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-line">
        {data.entries.map((e) => (
          <li key={e._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <Badge color={ACTION_COLORS[e.action] ?? '#579bfc'}>{t(`admin.actions.${e.action}`, { defaultValue: e.action })}</Badge>
            <span className="font-semibold">{e.actorName}</span>
            {e.targetName && (
              <span className="text-muted">
                → {e.target ? <Link to={`/admin/users/${e.target}`} className="text-brand hover:underline">{e.targetName}</Link> : e.targetName} {e.targetEmail && `(${e.targetEmail})`}
              </span>
            )}
            {e.details?.task && (
              <span className="text-muted">
                <span className="font-mono text-xs">{e.details.task}</span> {e.details.title}
                {e.details.status && ` → ${e.details.status}`}
              </span>
            )}
            {e.details?.fields?.length > 0 && <span className="text-xs text-muted">{e.details.fields.join(', ')}</span>}
            <span className="ml-auto text-xs text-muted" title={formatDateTime(e.createdAt)}>
              {relativeTime(e.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      <Pager page={data.page} pages={data.pages} onPage={setPage} />
    </div>
  );
}

function Pager({ page, pages, onPage }) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-sm">
      <span className="text-muted">{t('admin.page', { page, pages })}</span>
      <button type="button" className="btn-icon h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('admin.previous')}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" className="btn-icon h-8 w-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('admin.next')}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function UsersList() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .get('/admin/users', { params: { q: q.trim() || undefined, filter, page } })
      .then(({ data: body }) => setData(body))
      .catch((err) => toast.error(errorMessage(err)));
  }, [q, filter, page]);
  useEffect(() => {
    const timer = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input h-9 pl-9"
            placeholder={t('admin.searchUsers')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {['all', 'admins', 'suspended'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={clsx('rounded-md px-3 py-1 text-xs font-semibold transition', filter === f ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
            >
              {t(`admin.filter.${f}`)}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary ml-auto h-9" onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">{t('admin.addUser')}</span>
        </button>
      </div>

      {!data ? (
        <Skeleton className="h-64" />
      ) : data.users.length === 0 ? (
        <EmptyState compact illustration="search" title={t('admin.noUsers')} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line" data-testid="admin-users">
            {data.users.map((u) => (
              <li key={u._id}>
                <Link to={`/admin/users/${u._id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60">
                  <Avatar user={u} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{u.name}</span>
                      <AdminBadges user={u} />
                    </p>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-muted">
                    <span title={t('admin.projects')}>
                      <FolderKanban className="mr-1 inline h-3.5 w-3.5" />
                      {u.projects}
                    </span>
                    <span title={t('admin.openTasks')}>
                      <ListTodo className="mr-1 inline h-3.5 w-3.5" />
                      {u.openTasks}
                    </span>
                    <span className="hidden w-32 text-right sm:inline" title={t('admin.lastLogin')}>
                      {u.lastLoginAt ? relativeTime(u.lastLoginAt) : t('admin.never')}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
}

/** Platform administration (only for admins; the route is hidden for everyone else). */
export default function AdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'audit' ? 'audit' : 'users';
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api
      .get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#a25ddc]/15 text-[#a25ddc]">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('admin.title')}</h1>
          <p className="text-sm text-muted">{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={Users} color="#6161ff" label={t('admin.stats.users')} value={stats?.users} hint={stats && t('admin.stats.newUsers', { count: stats.newUsers })} />
        <Stat icon={Activity} color="#00c875" label={t('admin.stats.active')} value={stats?.active} hint={t('admin.stats.last7')} />
        <Stat icon={FolderKanban} color="#fdab3d" label={t('admin.stats.projects')} value={stats?.projects} hint={stats && t('admin.stats.tasks', { count: stats.tasks, open: stats.openTasks })} />
        <Stat icon={UserX} color="#e2445c" label={t('admin.stats.suspended')} value={stats?.suspended} hint={stats && t('admin.stats.admins', { count: stats.admins })} />
      </div>

      <div className="flex gap-1 border-b border-line">
        {['users', 'audit'].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setParams(id === 'users' ? {} : { tab: id })}
            className={clsx('-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition', tab === id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}
          >
            {t(`admin.tabs.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'users' ? <UsersList /> : <Audit />}
      <p className="text-center text-[11px] text-muted">{stats && t('admin.generated', { date: formatDate(new Date(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}</p>
    </div>
  );
}
