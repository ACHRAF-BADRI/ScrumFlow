import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarDays, ChevronDown, Gauge, ListChecks, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { formatDate, taskKey } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { TypeIcon } from '../../components/ui/Badge';
import { EmptyState, ProgressBar } from '../../components/ui/Feedback';
import SprintGoal from '../../components/sprints/SprintGoal';

const DAY = 24 * 60 * 60 * 1000;

const completionRate = (s) => (s.committedPoints ? Math.round((s.completedPoints / s.committedPoints) * 100) : null);

// Green when the team delivered what it committed to, orange when close, red otherwise
const rateColor = (rate) => (rate === null ? '#a1a3b8' : rate >= 90 ? '#00c875' : rate >= 70 ? '#fdab3d' : '#e2445c');

function Summary({ sprints }) {
  const { t } = useTranslation();
  const avgVelocity = Math.round(sprints.reduce((sum, s) => sum + s.completedPoints, 0) / sprints.length);
  const rated = sprints.map(completionRate).filter((r) => r !== null);
  const avgRate = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : null;

  const items = [
    { icon: Trophy, color: '#6161ff', label: t('history.sprints'), value: sprints.length },
    { icon: Gauge, color: '#fdab3d', label: t('history.avgVelocity'), value: avgVelocity, hint: t('history.avgVelocityHint') },
    { icon: ListChecks, color: rateColor(avgRate), label: t('history.avgCompletion'), value: avgRate === null ? '—' : `${avgRate}%`, hint: t('history.avgCompletionHint') },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map(({ icon: Icon, color, label, value, hint }) => (
        <div key={label} className="card flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1f`, color }}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="text-2xl font-extrabold leading-tight">{value}</p>
            {hint && <p className="truncate text-xs text-muted">{hint}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SprintCard({ sprint, tasks }) {
  const { t } = useTranslation();
  const { project } = useProject();
  const { openTask } = useOutletContext();
  const [open, setOpen] = useState(false);

  const rate = completionRate(sprint);
  const color = rateColor(rate);
  const days = sprint.startDate && sprint.endDate ? Math.max(1, Math.round((new Date(sprint.endDate) - new Date(sprint.startDate)) / DAY)) : null;

  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-bold">{sprint.name}</h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              {sprint.startDate ? `${formatDate(sprint.startDate)} → ${formatDate(sprint.endDate)}` : '—'}
              {days && ` · ${t('history.days', { count: days })}`}
            </span>
          </div>
          <SprintGoal goal={sprint.goal} className="mt-1.5" />
          {sprint.completedAt && (
            <p className="mt-1.5 text-xs text-muted">{t('history.completedOn', { date: formatDate(sprint.completedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-4 text-center md:w-80">
          <div>
            <p className="text-xl font-extrabold">{sprint.committedPoints}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('history.committed')}</p>
          </div>
          <div>
            <p className="text-xl font-extrabold" style={{ color: '#00c875' }}>
              {sprint.completedPoints}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('history.delivered')}</p>
          </div>
          <div>
            <p className="text-xl font-extrabold" style={{ color }}>
              {rate === null ? '—' : `${rate}%`}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('history.completion')}</p>
          </div>
          <ProgressBar value={rate ?? 0} color={color} className="col-span-3" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 text-left text-sm font-semibold text-muted transition hover:text-ink sm:px-5"
        aria-expanded={open}
      >
        <ChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
        {t('history.tasksDelivered', { count: tasks.length })}
        <span className="ml-auto text-xs font-medium">{open ? t('history.hideTasks') : t('history.showTasks')}</span>
      </button>

      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {tasks.length === 0 && <li className="px-5 py-4 text-sm text-muted">{t('history.noTasks')}</li>}
          {tasks.map((task) => (
            <li key={task._id}>
              <button type="button" onClick={() => openTask(task._id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-surface-2 sm:px-5">
                <TypeIcon type={task.type} className="h-3.5 w-3.5" />
                <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:inline">{taskKey(project, task)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                {task.points > 0 && <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted">{task.points}</span>}
                <Avatar user={task.assignee} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function HistoryView() {
  const { t } = useTranslation();
  const { sprints, tasks } = useProject();

  const completed = useMemo(
    () => sprints.filter((s) => s.status === 'completed').sort((a, b) => new Date(b.completedAt ?? 0) - new Date(a.completedAt ?? 0)),
    [sprints]
  );

  if (completed.length === 0) {
    return <EmptyState illustration="history" title={t('history.empty')} text={t('history.emptyText')} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <Summary sprints={completed} />
      {completed.map((sprint) => (
        <SprintCard key={sprint._id} sprint={sprint} tasks={tasks.filter((task) => task.sprint === sprint._id).sort((a, b) => a.order - b.order)} />
      ))}
    </div>
  );
}
