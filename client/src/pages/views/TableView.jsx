import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, GripVertical, History, MessageSquare, MessagesSquare, MoreHorizontal, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { useContainerDnd } from '../../hooks/useContainerDnd';
import { toastError } from '../../lib/api';
import { useStatuses } from '../../hooks/useStatuses';
import { daysLeft, formatDate, isOverdue, taskKey, toDateInput } from '../../lib/format';
import { LabelChip, SprintStatusBadge, TypeIcon } from '../../components/ui/Badge';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState, Spinner } from '../../components/ui/Feedback';
import { Popover } from '../../components/ui/Popover';
import { AssigneePicker, PointsPicker, PriorityPicker, StatusPicker } from '../../components/tasks/Pickers';
import { CompleteSprintModal, SprintModal } from '../../components/sprints/SprintModals';
import SprintGoal from '../../components/sprints/SprintGoal';
import { ChecklistBadge } from '../../components/tasks/Checklist';
import { EpicChip } from '../../components/tasks/Epics';
import { BlockedIcon, useTaskIndex } from '../../components/tasks/Dependencies';
import Tooltip from '../../components/ui/Tooltip';

const GRID = 'grid grid-cols-[minmax(240px,1fr)_76px_148px_120px_64px_128px]';
const GROUP_COLORS = { active: '#6161ff', planned: '#579bfc', backlog: '#a1a3b8' };

function StatusBattery({ tasks }) {
  const { list } = useStatuses();
  if (!tasks.length) return <div className="h-5 rounded bg-surface-2" />;
  return (
    <div className="flex h-5 overflow-hidden rounded">
      {list.map((s) => {
        const count = tasks.filter((task) => task.status === s.key).length;
        if (!count) return null;
        return (
          <Tooltip key={s.key} label={`${s.name}: ${count} (${Math.round((count / tasks.length) * 100)}%)`}>
            <div className="transition-all hover:brightness-110" style={{ width: `${(count / tasks.length) * 100}%`, background: s.color }} />
          </Tooltip>
        );
      })}
    </div>
  );
}

function DueDateCell({ task, onChange }) {
  const overdue = isOverdue(task);
  return (
    <label className={clsx('relative flex h-full cursor-pointer items-center justify-center gap-1.5 px-2 text-[13px] hover:bg-surface-2', overdue ? 'font-semibold text-[#e2445c]' : 'text-muted')}>
      {task.dueDate ? formatDate(task.dueDate) : <CalendarDays className="h-4 w-4 opacity-40" />}
      <input
        type="date"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={toDateInput(task.dueDate)}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => e.currentTarget.showPicker?.()}
      />
    </label>
  );
}

function TaskRowView({ task, color, dragDisabled, overlay, isDragging, rowRef, style, handleRef, handleProps }) {
  const { project, updateTask } = useProject();
  const { openTask } = useOutletContext();
  const byId = useTaskIndex();
  const update = (changes) => updateTask(task._id, changes);

  return (
    <div
      ref={rowRef}
      style={style}
      className={clsx(GRID, 'group/row h-10 border-b border-line bg-surface text-sm', isDragging && 'opacity-40', overlay && 'rounded-md shadow-pop ring-1 ring-brand/40')}
    >
      <div className="sticky left-0 z-10 flex min-w-0 items-center gap-1.5 border-r border-line bg-inherit pr-2">
        <span className="h-full w-1.5 shrink-0" style={{ background: color }} />
        <button
          ref={handleRef}
          type="button"
          {...handleProps}
          className={clsx('touch-none rounded p-0.5 text-muted/50 hover:text-ink', dragDisabled ? 'invisible' : 'cursor-grab active:cursor-grabbing sm:opacity-0 sm:group-hover/row:opacity-100')}
          aria-label="drag"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <TypeIcon type={task.type} className="h-3.5 w-3.5" />
        <BlockedIcon task={task} byId={byId} className="shrink-0" />
        <button type="button" onClick={() => openTask(task._id)} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
          <span className={clsx('min-w-[5rem] truncate font-medium hover:text-brand', task.completedAt && 'text-muted line-through decoration-muted/50')}>{task.title}</span>
          <span className="hidden shrink-0 font-mono text-[11px] text-muted md:inline">{taskKey(project, task)}</span>
          {/* Epic and labels only when the row is wide enough, and they give way first */}
          <span className="hidden min-w-0 shrink items-center gap-1 overflow-hidden 2xl:flex">
            <EpicChip epicId={task.epic} />
            {task.labels?.slice(0, 2).map((l) => (
              <LabelChip key={l}>{l}</LabelChip>
            ))}
          </span>
        </button>
        <ChecklistBadge checklist={task.checklist} />
        {task.comments?.length > 0 && (
          <button type="button" onClick={() => openTask(task._id)} className="flex shrink-0 items-center gap-1 text-xs text-muted hover:text-brand">
            <MessageSquare className="h-3.5 w-3.5" />
            {task.comments.length}
          </button>
        )}
      </div>
      <div className="border-r border-line">
        <AssigneePicker variant="cell" value={task.assignee?._id ?? null} onChange={(assignee) => update({ assignee })} />
      </div>
      <div className="border-r border-line p-px" data-tour="status-cell">
        <StatusPicker variant="cell" value={task.status} onChange={(status) => update({ status })} />
      </div>
      <div className="border-r border-line p-px">
        <PriorityPicker variant="cell" value={task.priority} onChange={(priority) => update({ priority })} />
      </div>
      <div className="border-r border-line">
        <PointsPicker variant="cell" value={task.points} onChange={(points) => update({ points })} />
      </div>
      <div>
        <DueDateCell task={task} onChange={(dueDate) => update({ dueDate })} />
      </div>
    </div>
  );
}

function SortableTaskRow({ task, color, dragDisabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task._id, disabled: dragDisabled });
  return (
    <TaskRowView
      task={task}
      color={color}
      dragDisabled={dragDisabled}
      isDragging={isDragging}
      rowRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      handleRef={setActivatorNodeRef}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

const InlineAdd = forwardRef(function InlineAdd({ sprintId, color }, ref) {
  const { t } = useTranslation();
  const { createTask } = useProject();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  const submit = async ({ keepFocus = true } = {}) => {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await createTask({ title: value, sprint: sprintId === 'backlog' ? null : sprintId });
      setTitle('');
      // Stay in the field so several tasks can be typed in a row
      if (keepFocus) inputRef.current?.focus();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    // The whole row focuses the field, not only the text
    <div
      data-tour="add-row"
      onClick={() => inputRef.current?.focus()}
      className={clsx(
        GRID,
        'group/add h-10 cursor-text border-b border-line bg-surface transition-colors hover:bg-surface-2/60',
        'focus-within:bg-brand/[0.04] focus-within:hover:bg-brand/[0.04]'
      )}
    >
      <div className="sticky left-0 z-10 col-span-6 flex items-center gap-2 bg-inherit pr-3">
        <span className="h-full w-1.5 shrink-0 opacity-40 transition-opacity group-focus-within/add:opacity-100" style={{ background: color }} />
        <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition group-hover/add:bg-brand/10 group-hover/add:text-brand group-focus-within/add:bg-brand group-focus-within/add:text-white">
          {saving ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
        </span>
        <input
          ref={inputRef}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted/80 group-hover/add:placeholder:text-brand"
          placeholder={t('task.add').replace('+ ', '')}
          aria-label={t('task.add').replace('+ ', '')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setTitle('');
              e.currentTarget.blur();
            }
          }}
          onBlur={() => title.trim() && submit({ keepFocus: false })}
          maxLength={200}
        />
        <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted group-focus-within/add:flex">
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans font-semibold">↵</kbd>
          {t('task.addHint')}
        </span>
      </div>
    </div>
  );
});

function GroupMenu({ sprint, onEdit, onStart, onComplete, onDelete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Popover
      align="end"
      trigger={({ toggle, ref }) => (
        <button ref={ref} type="button" className="btn-icon h-8 w-8" onClick={toggle} aria-label="menu">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <button type="button" className="menu-item" onClick={() => (close(), onEdit())}>
            <Pencil className="h-4 w-4" /> {t('common.edit')}
          </button>
          {sprint.status === 'planned' && (
            <button type="button" className="menu-item" onClick={() => (close(), onStart())}>
              <Play className="h-4 w-4" /> {t('sprint.start')}
            </button>
          )}
          {sprint.status === 'active' && (
            <button type="button" className="menu-item" onClick={() => (close(), navigate(`retro/${sprint._id}`))}>
              <MessagesSquare className="h-4 w-4" /> {t('retro.open')}
            </button>
          )}
          {sprint.status === 'active' && (
            <button type="button" className="menu-item" onClick={() => (close(), onComplete())}>
              <CheckCircle2 className="h-4 w-4" /> {t('sprint.complete')}
            </button>
          )}
          {sprint.status !== 'active' && (
            <button type="button" className="menu-item text-[#e2445c]" onClick={() => (close(), onDelete())}>
              <Trash2 className="h-4 w-4" /> {t('common.delete')}
            </button>
          )}
        </>
      )}
    </Popover>
  );
}

function Group({ id, sprint, taskIds, allTasks, dragDisabled, onSprintAction }) {
  const { t } = useTranslation();
  const { canManage, tasks } = useProject();
  const [collapsed, setCollapsed] = useState(false);
  const addRef = useRef(null);
  const { setNodeRef, isOver } = useDroppable({ id, disabled: dragDisabled });

  const status = sprint?.status ?? 'backlog';
  const color = GROUP_COLORS[status];
  const byId = useMemo(() => Object.fromEntries(tasks.map((task) => [task._id, task])), [tasks]);
  const rows = taskIds.map((taskId) => byId[taskId]).filter(Boolean);
  const points = allTasks.reduce((sum, task) => sum + (task.points || 0), 0);
  const remaining = sprint?.status === 'active' ? daysLeft(sprint.endDate) : null;

  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex min-w-0 items-center gap-1.5 text-left" style={{ color }}>
          {collapsed ? <ChevronRight className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
          <h2 className="truncate text-lg font-bold">{sprint?.name ?? t('common.backlog')}</h2>
        </button>
        {sprint && <SprintStatusBadge status={sprint.status} />}
        <span className="text-xs font-medium text-muted">
          {allTasks.length} · {points} {t('common.points')}
          {sprint?.startDate && ` · ${formatDate(sprint.startDate)} → ${formatDate(sprint.endDate)}`}
          {remaining !== null && ` · ${remaining >= 0 ? t('sprint.daysLeft', { count: remaining }) : t('sprint.ended')}`}
        </span>
        {canManage && sprint && (
          <div className="ml-auto flex items-center gap-1">
            {sprint.status === 'planned' && (
              <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => onSprintAction('start', sprint)}>
                <Play className="h-3.5 w-3.5" /> {t('sprint.start')}
              </button>
            )}
            {sprint.status === 'active' && (
              <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => onSprintAction('complete', sprint)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('sprint.complete')}
              </button>
            )}
            <GroupMenu
              sprint={sprint}
              onEdit={() => onSprintAction('edit', sprint)}
              onStart={() => onSprintAction('start', sprint)}
              onComplete={() => onSprintAction('complete', sprint)}
              onDelete={() => onSprintAction('delete', sprint)}
            />
          </div>
        )}
      </div>
      {!collapsed && sprint?.goal && <SprintGoal goal={sprint.goal} className="mb-2 ml-7" />}
      {!collapsed && !sprint && <p className="mb-2 ml-7 text-sm text-muted">{t('sprint.backlogHint')}</p>}

      {!collapsed && (
        <div className="overflow-x-auto rounded-lg border border-line shadow-card">
          <div className="min-w-[780px]">
            <div className={clsx(GRID, 'h-9 border-b border-line bg-surface text-xs font-semibold text-muted')}>
              <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-line bg-surface">
                <span className="h-full w-1.5" style={{ background: color }} />
                <span className="pl-7">{t('task.column')}</span>
              </div>
              {['task.assignee', 'task.status', 'task.priority', 'task.points', 'task.dueDate'].map((key) => (
                <div key={key} className="flex items-center justify-center border-r border-line px-1 text-center last:border-r-0">
                  {t(key)}
                </div>
              ))}
            </div>

            <SortableContext id={id} items={taskIds} strategy={verticalListSortingStrategy}>
              <div ref={setNodeRef} className={clsx('min-h-[40px] transition-colors', isOver && 'bg-brand/5')}>
                {rows.map((task) => (
                  <SortableTaskRow key={task._id} task={task} color={color} dragDisabled={dragDisabled} />
                ))}
                {rows.length === 0 && (
                  <button
                    type="button"
                    onClick={() => addRef.current?.focus()}
                    className="flex h-10 w-full items-center border-b border-line bg-surface pl-10 text-left text-xs text-muted transition hover:text-brand"
                  >
                    {t('sprint.emptyGroup')}
                  </button>
                )}
              </div>
            </SortableContext>

            <InlineAdd ref={addRef} sprintId={id} color={color} />

            <div className={clsx(GRID, 'h-10 bg-surface')}>
              <div className="sticky left-0 bg-surface" />
              <div />
              <div className="flex items-center px-1.5">
                <div className="w-full">
                  <StatusBattery tasks={allTasks} />
                </div>
              </div>
              <div />
              <div className="flex items-center justify-center text-xs font-bold text-muted">{points}</div>
              <div />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TableView() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { filterTasks, filtersActive, clearFilters, openNewTask } = useOutletContext();
  const { tasks, sprints, canManage, moveTask, deleteSprint, pause, resume } = useProject();
  const [dialog, setDialog] = useState(null); // { type, sprint }

  const openSprints = useMemo(
    () => [...sprints.filter((s) => s.status === 'active'), ...sprints.filter((s) => s.status === 'planned')],
    [sprints]
  );
  const completedCount = sprints.filter((s) => s.status === 'completed').length;
  const containerIds = useMemo(() => [...openSprints.map((s) => s._id), 'backlog'], [openSprints]);

  const onMove = useCallback(
    (taskId, from, to, ordered) => {
      const changes = from !== to ? { sprint: to === 'backlog' ? null : to } : null;
      moveTask(taskId, changes, ordered);
      if (changes) {
        const target = to === 'backlog' ? t('common.backlog') : sprints.find((s) => s._id === to)?.name;
        toast.success(t('task.moved', { target }));
      }
    },
    [moveTask, sprints, t]
  );

  const { columns, activeId, handlers } = useContainerDnd({
    tasks,
    containerIds,
    getContainer: (task) => task.sprint ?? 'backlog',
    onMove,
    onDragStart: pause,
    onDragEnd: resume,
  });

  const visible = useMemo(() => new Set(filterTasks(tasks).map((task) => task._id)), [filterTasks, tasks]);
  const activeTask = activeId ? tasks.find((task) => task._id === activeId) : null;

  const onSprintAction = async (type, sprint) => {
    if (type !== 'delete') {
      setDialog({ type, sprint });
      return;
    }
    const ok = await confirm({ title: t('common.delete'), message: t('sprint.deleteConfirm'), danger: true, confirmLabel: t('common.delete') });
    if (!ok) return;
    try {
      await deleteSprint(sprint._id);
      toast.success(t('sprint.deleted'));
    } catch (err) {
      toastError(err);
    }
  };

  const groupTasks = (id) => tasks.filter((task) => (task.sprint ?? 'backlog') === id);
  const noResults = filtersActive && visible.size === 0;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canManage && (
          <button type="button" className="btn-secondary" onClick={() => setDialog({ type: 'create' })} data-tour="new-sprint">
            <Plus className="h-4 w-4" /> {t('sprint.new')}
          </button>
        )}
        {filtersActive && <span className="text-xs text-muted">{t('filters.dragDisabled')}</span>}
      </div>

      {noResults ? (
        <EmptyState
          illustration="search"
          title={t('filters.noResults')}
          text={t('filters.noResultsText')}
          action={
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              <X className="h-4 w-4" /> {t('common.clearFilters')}
            </button>
          }
        />
      ) : (
        <DndContext {...handlers}>
          {containerIds.map((id) => {
            const sprint = sprints.find((s) => s._id === id);
            const ids = (columns[id] ?? []).filter((taskId) => visible.has(taskId));
            if (filtersActive && ids.length === 0) return null;
            return (
              <Group
                key={id}
                id={id}
                sprint={sprint}
                taskIds={ids}
                allTasks={groupTasks(id)}
                dragDisabled={filtersActive}
                onSprintAction={onSprintAction}
              />
            );
          })}

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className="min-w-[780px]">
                <TaskRowView task={activeTask} color={GROUP_COLORS.active} overlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {completedCount > 0 && !filtersActive && (
        <Link to="history" className="group mt-2 inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-brand">
          <History className="h-4 w-4" />
          {t('history.link', { count: completedCount })}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {tasks.length === 0 && !filtersActive && (
        <div className="mt-2 text-center">
          <button type="button" className="btn-primary" onClick={() => openNewTask()}>
            <Plus className="h-4 w-4" /> {t('task.new')}
          </button>
        </div>
      )}

      <SprintModal open={['create', 'edit', 'start'].includes(dialog?.type)} mode={dialog?.type} sprint={dialog?.sprint} onClose={() => setDialog(null)} />
      <CompleteSprintModal open={dialog?.type === 'complete'} sprint={dialog?.sprint} onClose={() => setDialog(null)} />
    </div>
  );
}
