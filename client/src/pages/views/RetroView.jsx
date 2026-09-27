import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Check, ListPlus, Lightbulb, Rocket, ThumbsUp, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { useRealtimeEvent } from '../../context/RealtimeContext';
import { api, errorMessage, toastError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState, PageLoader } from '../../components/ui/Feedback';
import Tooltip from '../../components/ui/Tooltip';

const COLUMNS = [
  { id: 'wentWell', color: '#00c875', icon: TrendingUp },
  { id: 'toImprove', color: '#fdab3d', icon: Lightbulb },
  { id: 'actions', color: '#6161ff', icon: Rocket },
];

function Card({ item, column, onChange, sprintBase, canManage }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { project } = useProject();
  const { openTask } = useOutletContext();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const mine = item.author?._id === user._id;
  const voted = item.votes.includes(user._id);
  const call = (request) => request.then(({ data }) => onChange(data.sprint)).catch(toastError);

  const save = () => {
    setEditing(false);
    const value = text.trim();
    if (!value || value === item.text) return setText(item.text);
    call(api.patch(`${sprintBase}/retro/${item._id}`, { text: value }));
  };

  const toTask = async () => {
    try {
      const { data } = await api.post(`${sprintBase}/retro/${item._id}/task`);
      onChange(data.sprint);
      toast.success(t('task.created', { key: `${project.key}-${data.task.number}` }), {
        action: { label: t('notifications.open'), onClick: () => openTask(data.task._id) },
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <li className="group rounded-xl border border-line bg-surface p-3 shadow-card">
      <div className="flex gap-2">
        {column.id === 'actions' && (
          <button
            type="button"
            role="checkbox"
            aria-checked={item.done}
            onClick={() => call(api.patch(`${sprintBase}/retro/${item._id}`, { done: !item.done }))}
            className={clsx('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition', item.done ? 'border-[#00c875] bg-[#00c875] text-white' : 'border-line hover:border-brand')}
          >
            {item.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
          </button>
        )}
        {editing ? (
          <textarea
            autoFocus
            rows={3}
            className="input min-w-0 flex-1 resize-none py-1 text-sm"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setText(item.text);
                setEditing(false);
              }
            }}
          />
        ) : (
          <p
            onClick={() => (mine || canManage) && setEditing(true)}
            className={clsx('min-w-0 flex-1 whitespace-pre-wrap break-words text-sm', (mine || canManage) && 'cursor-text', item.done && 'text-muted line-through')}
          >
            {item.text}
          </p>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Avatar user={item.author} size="xs" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{item.author?.name}</span>
        {column.id === 'actions' && !item.task && (
          <Tooltip label={t('retro.toTask')}>
            <button type="button" onClick={toTask} className="btn-icon h-7 w-7 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
              <ListPlus className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        {column.id === 'actions' && item.task && (
          <button type="button" onClick={() => openTask(item.task)} className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand hover:underline">
            {t('retro.isTask')}
          </button>
        )}
        {(mine || canManage) && (
          <Tooltip label={t('common.delete')}>
            <button type="button" onClick={() => call(api.delete(`${sprintBase}/retro/${item._id}`))} className="btn-icon h-7 w-7 opacity-0 transition hover:text-[#e2445c] group-hover:opacity-100 focus-visible:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        <button
          type="button"
          onClick={() => call(api.post(`${sprintBase}/retro/${item._id}/vote`))}
          aria-pressed={voted}
          className={clsx('flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition', voted ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-ink')}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> {item.votes.length}
        </button>
      </div>
    </li>
  );
}

function AddCard({ column, onAdd }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    await onAdd(column.id, value);
  };
  return (
    <textarea
      rows={2}
      className="input resize-none text-sm"
      placeholder={t(`retro.placeholder.${column.id}`)}
      value={text}
      maxLength={300}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      }}
    />
  );
}

export default function RetroView() {
  const { t } = useTranslation();
  const { sprintId } = useParams();
  const { project, canManage } = useProject();
  const [sprint, setSprint] = useState(null);
  const [error, setError] = useState(null);
  const sprintBase = `/projects/${project._id}/sprints/${sprintId}`;

  const load = useCallback(
    () =>
      api
        .get(`${sprintBase}/retro`)
        .then(({ data }) => setSprint(data.sprint))
        .catch(setError),
    [sprintBase]
  );
  useEffect(() => {
    load();
  }, [load]);
  // A teammate added or voted: refresh
  useRealtimeEvent('project:changed', (event) => event.projectId === project._id && load());

  const add = (column, text) =>
    api
      .post(`${sprintBase}/retro`, { column, text })
      .then(({ data }) => setSprint(data.sprint))
      .catch(toastError);

  if (error) return <EmptyState illustration="error" title={errorMessage(error)} action={<Link to="../../history" relative="path" className="btn-secondary">{t('common.back')}</Link>} />;
  if (!sprint) return <PageLoader />;

  const byVotes = (a, b) => b.votes.length - a.votes.length || new Date(a.createdAt) - new Date(b.createdAt);

  return (
    <div className="p-4 sm:p-6">
      <Link to={sprint.status === 'completed' ? '../../history' : '../..'} relative="path" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> {sprint.status === 'completed' ? t('views.history') : t('views.table')}
      </Link>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold tracking-tight">{t('retro.title', { name: sprint.name })}</h2>
        <p className="text-sm text-muted">
          {sprint.startDate && `${formatDate(sprint.startDate)} → ${formatDate(sprint.endDate)} · `}
          {t('retro.subtitle')}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const Icon = column.icon;
          const items = sprint.retro.filter((i) => i.column === column.id).sort(byVotes);
          return (
            <section key={column.id} className="flex flex-col rounded-2xl bg-surface-2/70 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${column.color}22`, color: column.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold">{t(`retro.${column.id}`)}</h3>
                <span className="rounded-full bg-surface px-2 text-xs font-bold text-muted">{items.length}</span>
              </div>
              <div className="mb-3 h-0.5 rounded-full" style={{ background: column.color }} />
              <AddCard column={column} onAdd={add} />
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <Card key={item._id} item={item} column={column} onChange={setSprint} sprintBase={sprintBase} canManage={canManage} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
