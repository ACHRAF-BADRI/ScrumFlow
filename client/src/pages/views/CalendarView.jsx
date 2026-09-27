import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { useStatuses } from '../../hooks/useStatuses';
import { formatDate, isOverdue, taskKey } from '../../lib/format';
import { TypeIcon } from '../../components/ui/Badge';

const DAY = 86400000;
const MAX_CHIPS = 3;
// Local calendar day as YYYY-MM-DD (the value stored as due date)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Due dates are saved as UTC midnight: read their calendar day in UTC
const dueDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
// Sprint dates can be a date (UTC midnight) or a moment (sprint started "now"): read moments in local time
const sprintDay = (value) => {
  if (!value) return null;
  const d = new Date(value);
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return dateOnly ? d.toISOString().slice(0, 10) : ymd(d);
};

/** Weeks (Monday first) covering the whole month. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const days = [];
  for (let d = new Date(start); d <= last || days.length % 7 !== 0; d = new Date(d.getTime() + DAY)) {
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return days;
}

function Chip({ task, dragging }) {
  const { project } = useProject();
  const { map } = useStatuses();
  const { openTask } = useOutletContext();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task._id });
  const color = map[task.status]?.color ?? '#a1a3b8';
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => openTask(task._id)}
      className={clsx(
        'flex w-full touch-none items-center gap-1 truncate rounded-md border-l-[3px] bg-surface px-1.5 py-0.5 text-left text-[11px] shadow-sm transition hover:shadow',
        isDragging && !dragging && 'opacity-30',
        dragging && 'shadow-pop ring-2 ring-brand/40',
        task.completedAt && 'text-muted line-through',
        isOverdue(task) && 'text-[#e2445c]'
      )}
      style={{ borderLeftColor: color }}
      title={`${taskKey(project, task)} · ${task.title}`}
    >
      <span className="truncate font-medium">{task.title}</span>
    </button>
  );
}

function DayCell({ day, tasks, inMonth, today, inSprint, sprintStart, onMore }) {
  const { t } = useTranslation();
  const key = ymd(day);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative flex min-h-[112px] flex-col gap-1 border-b border-r border-line p-1.5 transition-colors',
        !inMonth && 'bg-surface-2/40 text-muted',
        inMonth && weekend && 'bg-surface-2/20',
        inSprint && 'bg-brand/[0.05]',
        isOver && '!bg-brand/10'
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx('flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-xs font-semibold', today && 'bg-brand text-white')}>{day.getDate()}</span>
        {sprintStart && <span className="truncate rounded bg-brand/15 px-1 text-[10px] font-bold text-brand">{sprintStart}</span>}
      </div>
      {tasks.slice(0, MAX_CHIPS).map((task) => (
        <Chip key={task._id} task={task} />
      ))}
      {tasks.length > MAX_CHIPS && (
        <button type="button" onClick={() => onMore(key)} className="text-left text-[11px] font-semibold text-brand hover:underline">
          {t('calendar.more', { count: tasks.length - MAX_CHIPS })}
        </button>
      )}
    </div>
  );
}

function Unscheduled({ tasks }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });
  return (
    <aside ref={setNodeRef} className={clsx('card hidden h-fit w-60 shrink-0 p-3 transition-colors xl:block', isOver && 'bg-brand/5')}>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold">
        <CalendarX2 className="h-4 w-4 text-muted" /> {t('calendar.unscheduled')} <span className="text-muted">({tasks.length})</span>
      </h3>
      <p className="mb-3 text-[11px] text-muted">{t('calendar.unscheduledHint')}</p>
      <div className="max-h-[520px] space-y-1 overflow-y-auto">
        {tasks.map((task) => (
          <Chip key={task._id} task={task} />
        ))}
      </div>
    </aside>
  );
}

export default function CalendarView() {
  const { t, i18n } = useTranslation();
  const { filterTasks, openTask } = useOutletContext();
  const { tasks, activeSprint, updateTask, project } = useProject();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [activeId, setActiveId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const visible = useMemo(() => filterTasks(tasks), [filterTasks, tasks]);
  const byDay = useMemo(() => {
    const map = {};
    for (const task of visible) {
      const d = dueDay(task.dueDate);
      if (d) (map[d] ??= []).push(task);
    }
    return map;
  }, [visible]);
  const unscheduled = visible.filter((task) => !task.dueDate && !task.completedAt && task.type !== 'epic');

  const sprintRange = activeSprint?.startDate
    ? { start: sprintDay(activeSprint.startDate), end: sprintDay(activeSprint.endDate), name: activeSprint.name }
    : null;
  const todayKey = ymd(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 1 + i), { weekday: 'short' }));
  const title = new Intl.DateTimeFormat(i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }).format(cursor);
  const shift = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const task = tasks.find((x) => x._id === active.id);
    const next = over.id === 'unscheduled' ? null : over.id;
    if (task && dueDay(task.dueDate) !== next) updateTask(task._id, { dueDate: next });
  };
  const activeTask = activeId ? tasks.find((x) => x._id === activeId) : null;
  const monthDays = days.filter((d) => d.getMonth() === cursor.getMonth());

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-bold capitalize">{title}</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-icon h-8 w-8" onClick={() => shift(-1)} aria-label={t('calendar.previous')}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            {t('calendar.today')}
          </button>
          <button type="button" className="btn-icon h-8 w-8" onClick={() => shift(1)} aria-label={t('calendar.next')}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="ml-auto hidden text-xs text-muted sm:block">{t('calendar.hint')}</p>
      </div>

      <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        {/* Month grid (tablet and desktop) */}
        <div className="hidden gap-4 sm:flex">
          <div className="card min-w-0 flex-1 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
              {weekdays.map((w) => (
                <div key={w} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = ymd(day);
                return (
                  <DayCell
                    key={key}
                    day={day}
                    tasks={byDay[key] ?? []}
                    inMonth={day.getMonth() === cursor.getMonth()}
                    today={key === todayKey}
                    inSprint={sprintRange && key >= sprintRange.start && key <= sprintRange.end}
                    sprintStart={sprintRange && key === sprintRange.start ? sprintRange.name : null}
                    onMore={setExpanded}
                  />
                );
              })}
            </div>
          </div>
          <Unscheduled tasks={unscheduled} />
        </div>

        {/* Agenda (phones) */}
        <ol className="space-y-3 sm:hidden">
          {monthDays.filter((d) => byDay[ymd(d)]?.length).length === 0 && <p className="card p-6 text-center text-sm text-muted">{t('calendar.emptyMonth')}</p>}
          {monthDays
            .filter((d) => byDay[ymd(d)]?.length)
            .map((d) => (
              <li key={ymd(d)} className="card p-3">
                <p className={clsx('mb-2 text-xs font-bold uppercase tracking-wide', ymd(d) === todayKey ? 'text-brand' : 'text-muted')}>
                  {formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div className="space-y-1">
                  {byDay[ymd(d)].map((task) => (
                    <button key={task._id} type="button" onClick={() => openTask(task._id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                      <TypeIcon type={task.type} className="h-3.5 w-3.5" />
                      <span className="shrink-0 font-mono text-[11px] text-muted">{taskKey(project, task)}</span>
                      <span className={clsx('truncate', task.completedAt && 'text-muted line-through')}>{task.title}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
        </ol>

        <DragOverlay dropAnimation={null}>{activeTask && <div className="w-48"><Chip task={activeTask} dragging /></div>}</DragOverlay>
      </DndContext>

      {/* All tasks of a busy day */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setExpanded(null)}>
          <div className="card w-full max-w-sm animate-pop-in p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-bold">{formatDate(expanded + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="space-y-1">
              {(byDay[expanded] ?? []).map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => {
                    setExpanded(null);
                    openTask(task._id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <TypeIcon type={task.type} className="h-3.5 w-3.5" />
                  <span className="shrink-0 font-mono text-[11px] text-muted">{taskKey(project, task)}</span>
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
