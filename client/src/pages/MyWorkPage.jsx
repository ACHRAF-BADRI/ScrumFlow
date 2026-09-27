import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlarmClock, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { api, toastError } from '../lib/api';
import { formatDate } from '../lib/format';
import { PriorityBadge, TypeIcon } from '../components/ui/Badge';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { OptionList, Popover } from '../components/ui/Popover';
import { StatusPicker } from '../components/tasks/Pickers';
import { ChecklistBadge } from '../components/tasks/Checklist';

const DAY = 86400000;
const startOfToday = () => new Date(new Date().toDateString()).getTime();

/** Due-date bucket of an open task. */
function bucketOf(task) {
  if (!task.dueDate) return 'noDate';
  const due = new Date(new Date(task.dueDate).toDateString()).getTime();
  const today = startOfToday();
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due < today + 7 * DAY) return 'week';
  return 'later';
}
const BUCKETS = [
  { id: 'overdue', color: '#e2445c' },
  { id: 'today', color: '#fdab3d' },
  { id: 'week', color: '#6161ff' },
  { id: 'later', color: '#579bfc' },
  { id: 'noDate', color: '#a1a3b8' },
];

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1f`, color }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-2xl font-extrabold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function TaskRow({ task, project, onStatus, onOpen }) {
  const overdue = bucketOf(task) === 'overdue' && task.status !== 'done';
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-surface-2/60 sm:flex-nowrap sm:px-5">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <TypeIcon type={task.type} className="h-3.5 w-3.5" />
        <span className="shrink-0 font-mono text-[11px] font-semibold text-muted">
          {project?.key}-{task.number}
        </span>
        <span className={clsx('truncate text-sm font-medium hover:text-brand', task.status === 'done' && 'text-muted line-through decoration-muted/50')}>{task.title}</span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <ChecklistBadge checklist={task.checklist} />
        <span className="hidden items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted md:inline-flex" title={task.sprint?.name}>
          <span className="h-2 w-2 rounded-full" style={{ background: project?.color }} />
          <span className="max-w-[120px] truncate">{project?.name}</span>
        </span>
        <span className="hidden lg:inline-flex">
          <PriorityBadge priority={task.priority} />
        </span>
        {task.dueDate && <span className={clsx('w-16 text-right text-xs', overdue ? 'font-semibold text-[#e2445c]' : 'text-muted')}>{formatDate(task.dueDate)}</span>}
        <StatusPicker variant="badge" value={task.status} onChange={onStatus} />
      </div>
    </li>
  );
}

export default function MyWorkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('open');
  const [data, setData] = useState({ open: null, done: null, projects: [] });
  const [projectFilter, setProjectFilter] = useState(null);

  const load = useCallback(async () => {
    try {
      const [open, done] = await Promise.all([api.get('/me/tasks'), api.get('/me/tasks', { params: { status: 'done' } })]);
      setData({ open: open.data.tasks, done: done.data.tasks, projects: open.data.projects });
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);
  // New assignment (bell) or project list change: refresh
  useRealtimeEvent('notification', () => load());
  useRealtimeEvent('projects:changed', () => load());

  const projectById = useMemo(() => Object.fromEntries(data.projects.map((p) => [String(p._id), p])), [data.projects]);
  const filtered = (list) => (list ?? []).filter((task) => !projectFilter || String(task.project) === projectFilter);
  const open = filtered(data.open);
  const done = filtered(data.done);

  const changeStatus = async (task, status) => {
    // Optimistic: move it between "To do" and "Done" right away
    setData((d) => {
      const updated = { ...task, status, completedAt: status === 'done' ? new Date().toISOString() : null };
      const openList = d.open.filter((x) => x._id !== task._id);
      const doneList = d.done.filter((x) => x._id !== task._id);
      return status === 'done' ? { ...d, open: openList, done: [updated, ...doneList] } : { ...d, open: [...openList, updated], done: doneList };
    });
    try {
      await api.patch(`/projects/${task.project}/tasks/${task._id}`, { status });
    } catch (err) {
      toastError(err);
      load();
    }
  };

  const openTask = (task) => navigate(`/projects/${task.project}?task=${task._id}`);
  const loading = data.open === null;
  const stats = {
    open: open.length,
    overdue: open.filter((x) => bucketOf(x) === 'overdue').length,
    week: open.filter((x) => ['today', 'week'].includes(bucketOf(x))).length,
    done: done.length,
  };

  const projectOptions = [
    { value: null, label: t('myWork.allProjects') },
    ...data.projects.map((p) => ({
      value: String(p._id),
      render: (
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          {p.name}
        </span>
      ),
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('myWork.title')}</h1>
        <p className="text-sm text-muted">{t('myWork.subtitle')}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListTodo} color="#6161ff" label={t('myWork.open')} value={loading ? '…' : stats.open} />
        <Stat icon={AlarmClock} color="#e2445c" label={t('myWork.overdue')} value={loading ? '…' : stats.overdue} />
        <Stat icon={CalendarClock} color="#fdab3d" label={t('myWork.thisWeek')} value={loading ? '…' : stats.week} />
        <Stat icon={CheckCircle2} color="#00c875" label={t('myWork.doneRecently')} value={loading ? '…' : stats.done} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist">
          {['open', 'done'].map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx('rounded-md px-3.5 py-1.5 text-sm font-semibold transition', tab === id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
            >
              {id === 'open' ? `${t('myWork.tabOpen')} (${stats.open})` : `${t('myWork.tabDone')} (${stats.done})`}
            </button>
          ))}
        </div>
        {data.projects.length > 1 && (
          <Popover
            align="end"
            width={220}
            trigger={({ toggle, ref }) => (
              <button ref={ref} type="button" onClick={toggle} className="btn-secondary h-9">
                {projectFilter && <span className="h-2.5 w-2.5 rounded-full" style={{ background: projectById[projectFilter]?.color }} />}
                {projectFilter ? projectById[projectFilter]?.name : t('myWork.allProjects')}
              </button>
            )}
          >
            {({ close }) => <OptionList options={projectOptions} value={projectFilter} onSelect={setProjectFilter} close={close} />}
          </Popover>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : tab === 'open' ? (
        open.length === 0 ? (
          <div className="card">
            <EmptyState illustration="history" title={t('myWork.emptyOpen')} text={t('myWork.emptyOpenText')} />
          </div>
        ) : (
          <div className="space-y-5">
            {BUCKETS.map((bucket) => {
              const list = open.filter((x) => bucketOf(x) === bucket.id);
              if (!list.length) return null;
              return (
                <section key={bucket.id}>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: bucket.color }} />
                    {t(`myWork.bucket.${bucket.id}`)} <span className="font-medium text-muted">({list.length})</span>
                  </h2>
                  <ul className="card divide-y divide-line overflow-hidden">
                    {list.map((task) => (
                      <TaskRow key={task._id} task={task} project={projectById[String(task.project)]} onStatus={(s) => changeStatus(task, s)} onOpen={() => openTask(task)} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : done.length === 0 ? (
        <div className="card">
          <EmptyState illustration="chart" title={t('myWork.emptyDone')} />
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {done.map((task) => (
            <TaskRow key={task._id} task={task} project={projectById[String(task.project)]} onStatus={(s) => changeStatus(task, s)} onOpen={() => openTask(task)} />
          ))}
        </ul>
      )}
    </div>
  );
}
