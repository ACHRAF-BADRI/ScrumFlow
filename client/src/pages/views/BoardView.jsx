import { useCallback, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, CheckCircle2, MessageSquare, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { useContainerDnd } from '../../hooks/useContainerDnd';
import { toastError } from '../../lib/api';
import { STATUSES } from '../../lib/constants';
import { daysLeft, formatDate, isOverdue, taskKey } from '../../lib/format';
import { LabelChip, PriorityBadge, TypeIcon } from '../../components/ui/Badge';
import { EmptyState, ProgressBar } from '../../components/ui/Feedback';
import { AssigneePicker } from '../../components/tasks/Pickers';
import { CompleteSprintModal } from '../../components/sprints/SprintModals';
import SprintGoal from '../../components/sprints/SprintGoal';
import Tooltip from '../../components/ui/Tooltip';

function CardView({ task, overlay, isDragging, cardRef, style, dragProps }) {
  const { t } = useTranslation();
  const { project, updateTask } = useProject();
  const { openTask } = useOutletContext();
  const overdue = isOverdue(task);

  return (
    <div
      ref={cardRef}
      style={style}
      {...dragProps}
      onClick={() => openTask(task._id)}
      className={clsx(
        'group cursor-pointer touch-manipulation select-none rounded-xl border border-line bg-surface p-3 shadow-card transition hover:border-brand/40 hover:shadow-md',
        isDragging && 'opacity-40',
        overlay && 'rotate-2 cursor-grabbing shadow-pop ring-2 ring-brand/40'
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <TypeIcon type={task.type} className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] font-semibold text-muted">{taskKey(project, task)}</span>
        {task.points > 0 && (
          <Tooltip label={t('common.pointsLong')}>
            <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted">{task.points}</span>
          </Tooltip>
        )}
      </div>
      <p className={clsx('text-sm font-semibold leading-snug', task.status === 'done' && 'text-muted line-through decoration-muted/50')}>{task.title}</p>
      {task.labels?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <LabelChip key={l}>{l}</LabelChip>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={clsx('flex items-center gap-1 text-[11px] font-medium', overdue ? 'text-[#e2445c]' : 'text-muted')}>
            <CalendarDays className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.comments?.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <MessageSquare className="h-3 w-3" />
            {task.comments.length}
          </span>
        )}
        <div className="ml-auto" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <AssigneePicker variant="avatar" value={task.assignee?._id ?? null} onChange={(assignee) => updateTask(task._id, { assignee })} />
        </div>
      </div>
    </div>
  );
}

function SortableCard({ task, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id, disabled });
  return (
    <CardView
      task={task}
      isDragging={isDragging}
      cardRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragProps={{ ...attributes, ...listeners }}
    />
  );
}

function QuickAdd({ sprintId, status }) {
  const { t } = useTranslation();
  const { createTask } = useProject();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');

  const submit = async () => {
    const value = title.trim();
    if (!value) return setEditing(false);
    setTitle('');
    try {
      await createTask({ title: value, sprint: sprintId, status });
    } catch (err) {
      toastError(err);
    }
  };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink">
        <Plus className="h-4 w-4" /> {t('task.add').replace('+ ', '')}
      </button>
    );
  }
  return (
    <textarea
      autoFocus
      rows={2}
      className="input resize-none"
      placeholder={t('task.addPlaceholder')}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Escape') {
          setTitle('');
          setEditing(false);
        }
      }}
    />
  );
}

function Column({ status, taskIds, byId, allTasks, disabled, sprintId }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status.id, disabled });
  const points = allTasks.reduce((sum, task) => sum + (task.points || 0), 0);

  return (
    <div className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl bg-surface-2/70 sm:w-[272px] 2xl:w-auto 2xl:max-w-none 2xl:flex-1">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
        <h3 className="text-sm font-bold">{t(`status.${status.id}`)}</h3>
        <span className="rounded-full bg-surface px-2 text-xs font-bold text-muted">{allTasks.length}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted">
          {points} {t('common.points')}
        </span>
      </div>
      <div className="mx-3 mb-2 h-0.5 rounded-full" style={{ background: status.color }} />
      <SortableContext id={status.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={clsx('flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl px-2 pb-2 transition-colors', isOver && 'bg-brand/5')}>
          {taskIds.map((id) => byId[id] && <SortableCard key={id} task={byId[id]} disabled={disabled} />)}
          <QuickAdd sprintId={sprintId} status={status.id} />
        </div>
      </SortableContext>
    </div>
  );
}

export default function BoardView() {
  const { t } = useTranslation();
  const { filterTasks, filtersActive } = useOutletContext();
  const { tasks, activeSprint, canManage, moveTask, pause, resume } = useProject();
  const [completing, setCompleting] = useState(false);

  const sprintTasks = useMemo(() => (activeSprint ? tasks.filter((task) => task.sprint === activeSprint._id) : []), [tasks, activeSprint]);
  const containerIds = useMemo(() => STATUSES.map((s) => s.id), []);

  const onMove = useCallback(
    (taskId, from, to, ordered) => moveTask(taskId, from !== to ? { status: to } : null, ordered),
    [moveTask]
  );

  const { columns, activeId, handlers } = useContainerDnd({
    tasks: sprintTasks,
    containerIds,
    getContainer: (task) => task.status,
    onMove,
    onDragStart: pause,
    onDragEnd: resume,
  });

  const byId = useMemo(() => Object.fromEntries(sprintTasks.map((task) => [task._id, task])), [sprintTasks]);
  const visible = useMemo(() => new Set(filterTasks(sprintTasks).map((task) => task._id)), [filterTasks, sprintTasks]);

  if (!activeSprint) {
    return (
      <EmptyState
        illustration="sprint"
        title={t('sprint.noActive')}
        text={t('sprint.noActiveText')}
        action={
          <Link to=".." relative="path" className="btn-primary">
            {t('sprint.goToPlanning')}
          </Link>
        }
      />
    );
  }

  const total = sprintTasks.reduce((s, task) => s + (task.points || 0), 0);
  const done = sprintTasks.filter((task) => task.status === 'done').reduce((s, task) => s + (task.points || 0), 0);
  const remaining = daysLeft(activeSprint.endDate);

  return (
    <div className="py-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{activeSprint.name}</h2>
          <SprintGoal goal={activeSprint.goal} className="mt-0.5" />
        </div>
        <div className="w-full max-w-[220px]">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
            <span>{t('sprint.progress')}</span>
            <span>
              {done}/{total} {t('common.points')}
            </span>
          </div>
          <ProgressBar value={total ? (done / total) * 100 : 0} />
        </div>
        <span className="text-sm font-semibold text-muted">
          {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)} ·{' '}
          <span className={clsx(remaining < 0 && 'text-[#e2445c]')}>{remaining >= 0 ? t('sprint.daysLeft', { count: remaining }) : t('sprint.ended')}</span>
        </span>
        {canManage && (
          <button type="button" className="btn-secondary ml-auto" onClick={() => setCompleting(true)}>
            <CheckCircle2 className="h-4 w-4" /> {t('sprint.complete')}
          </button>
        )}
      </div>
      {filtersActive && <p className="mb-3 px-4 text-xs text-muted sm:px-6">{t('filters.dragDisabled')}</p>}

      <DndContext {...handlers}>
        <div className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 sm:scroll-px-6 sm:px-6">
          {STATUSES.map((status) => (
            <Column
              key={status.id}
              status={status}
              byId={byId}
              taskIds={(columns[status.id] ?? []).filter((id) => visible.has(id))}
              allTasks={sprintTasks.filter((task) => task.status === status.id)}
              disabled={filtersActive}
              sprintId={activeSprint._id}
            />
          ))}
        </div>
        <DragOverlay>{activeId && byId[activeId] && <CardView task={byId[activeId]} overlay />}</DragOverlay>
      </DndContext>

      <CompleteSprintModal open={completing} sprint={activeSprint} onClose={() => setCompleting(false)} />
    </div>
  );
}
