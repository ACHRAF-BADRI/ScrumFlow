import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, ChevronLeft, ChevronRight, Lock, Play, Shuffle, Square, Timer, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { useStatuses } from '../../hooks/useStatuses';
import { formatDate, taskKey } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { TypeIcon } from '../../components/ui/Badge';
import { openBlockers, useTaskIndex } from '../../components/tasks/Dependencies';

const TIMEBOXES = [1, 2, 3];

/** Start of the previous working day (Friday when today is Monday or the weekend). */
export function previousWorkday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const back = { 0: 2, 1: 3, 6: 1 }[d.getDay()] ?? 1;
  d.setDate(d.getDate() - back);
  return d;
}

const clock = (seconds) => {
  const s = Math.abs(seconds);
  return `${seconds < 0 ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function TaskItem({ task, tone }) {
  const { project } = useProject();
  const { openTask } = useOutletContext();
  return (
    <li>
      <button type="button" onClick={() => openTask(task._id)} className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2">
        <TypeIcon type={task.type} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className={clsx('min-w-0 flex-1', tone === 'done' && 'text-muted')}>
          <span className="mr-1.5 font-mono text-[11px] font-semibold text-muted">{taskKey(project, task)}</span>
          {task.title}
        </span>
      </button>
    </li>
  );
}

function Section({ icon: Icon, color, title, tasks, tone, empty }) {
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color }}>
        <Icon className="h-3.5 w-3.5" /> {title} <span className="text-muted">({tasks.length})</span>
      </h4>
      {tasks.length ? (
        <ul>
          {tasks.map((task) => (
            <TaskItem key={task._id} task={task} tone={tone} />
          ))}
        </ul>
      ) : (
        <p className="px-1.5 text-xs text-muted">{empty}</p>
      )}
    </div>
  );
}

export default function StandupView() {
  const { t } = useTranslation();
  const { tasks, members } = useProject();
  const { map: statusMap } = useStatuses();
  const byId = useTaskIndex();
  const since = useMemo(() => previousWorkday(), []);

  const [order, setOrder] = useState(() => members.map((m) => m._id));
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [timebox, setTimebox] = useState(2);
  const [left, setLeft] = useState(timebox * 60);
  const cards = useRef({});

  // New or removed members while the page is open
  useEffect(() => {
    setOrder((list) => {
      const ids = members.map((m) => m._id);
      return [...list.filter((id) => ids.includes(id)), ...ids.filter((id) => !list.includes(id))];
    });
  }, [members]);

  const report = useMemo(() => {
    const out = {};
    for (const m of members) out[m._id] = { done: [], doing: [], blocked: [] };
    for (const task of tasks) {
      const row = out[task.assignee?._id];
      if (!row || task.type === 'epic') continue;
      if (task.completedAt) {
        if (new Date(task.completedAt) >= since) row.done.push(task);
        continue;
      }
      if (openBlockers(task, byId).length || task.status === 'stuck') row.blocked.push(task);
      else if (statusMap[task.status]?.category === 'in_progress') row.doing.push(task);
    }
    return out;
  }, [tasks, members, since, byId, statusMap]);

  // Countdown of the current speaker; it keeps going below zero, in red
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [running, current]);

  const speakerId = running ? order[current] : null;
  useEffect(() => {
    if (speakerId) cards.current[speakerId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [speakerId]);

  const goTo = (index) => {
    if (index >= order.length) return setRunning(false);
    setCurrent(Math.max(0, index));
    setLeft(timebox * 60);
  };
  const start = () => {
    setRunning(true);
    setCurrent(0);
    setLeft(timebox * 60);
  };
  const shuffle = () => setOrder((list) => [...list].sort(() => Math.random() - 0.5));

  const memberById = Object.fromEntries(members.map((m) => [m._id, m]));
  const speaker = memberById[speakerId];
  const blockedCount = Object.values(report).reduce((sum, r) => sum + r.blocked.length, 0);

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{t('standup.title')}</h2>
          <p className="text-sm text-muted">
            {t('standup.since', { date: formatDate(since, { weekday: 'long', day: 'numeric', month: 'long' }) })}
            {blockedCount > 0 && <span className="ml-2 font-semibold text-[#e2445c]">{t('standup.blockedCount', { count: blockedCount })}</span>}
          </p>
        </div>
        {!running && (
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              <Timer className="h-4 w-4" />
              <select className="input h-9 w-auto py-0" value={timebox} onChange={(e) => setTimebox(Number(e.target.value))} aria-label={t('standup.timebox')}>
                {TIMEBOXES.map((m) => (
                  <option key={m} value={m}>
                    {t('standup.minutes', { count: m })}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" onClick={shuffle}>
              <Shuffle className="h-4 w-4" /> {t('standup.shuffle')}
            </button>
            <button type="button" className="btn-primary" onClick={start} disabled={!members.length}>
              <Play className="h-4 w-4" /> {t('standup.start')}
            </button>
          </>
        )}
      </div>

      {running && speaker && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-surface p-3 shadow-pop">
          <Avatar user={speaker} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{t('standup.speaker', { index: current + 1, total: order.length })}</p>
            <p className="truncate font-bold">{speaker.name}</p>
          </div>
          <span className={clsx('font-mono text-2xl font-extrabold tabular-nums', left < 0 ? 'text-[#e2445c]' : left <= 15 ? 'text-[#fdab3d]' : 'text-ink')} data-testid="standup-clock">
            {clock(left)}
          </span>
          <div className="flex gap-1">
            <button type="button" className="btn-icon" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label={t('standup.previous')}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="btn-primary" onClick={() => goTo(current + 1)}>
              {current + 1 < order.length ? t('standup.next') : t('standup.finish')} <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn-secondary" onClick={() => setRunning(false)} aria-label={t('standup.stop')}>
              <Square className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((id, index) => {
          const member = memberById[id];
          const row = report[id];
          if (!member || !row) return null;
          const active = speakerId === id;
          return (
            <article
              key={id}
              ref={(el) => {
                cards.current[id] = el;
              }}
              className={clsx('card space-y-3 p-4 transition', active && 'border-brand ring-2 ring-brand/30', running && !active && 'opacity-50')}
            >
              <header className="flex items-center gap-2.5">
                <Avatar user={member} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{member.name}</p>
                  <p className="text-xs text-muted">{t(`role.${member.role}`)}</p>
                </div>
                {running && !active && (
                  <button type="button" className="btn-ghost h-7 px-2 text-xs" onClick={() => goTo(index)}>
                    {t('standup.giveTurn')}
                  </button>
                )}
              </header>
              <Section icon={CheckCircle2} color="#00c875" title={t('standup.done')} tasks={row.done} tone="done" empty={t('standup.nothing')} />
              <Section icon={Wrench} color="#fdab3d" title={t('standup.doing')} tasks={row.doing} empty={t('standup.nothing')} />
              <Section icon={Lock} color="#e2445c" title={t('standup.blocked')} tasks={row.blocked} empty={t('standup.noBlocker')} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
