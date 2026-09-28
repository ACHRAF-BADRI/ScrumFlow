import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Lock, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { taskKey } from '../../lib/format';
import { TypeIcon } from '../ui/Badge';
import { Popover } from '../ui/Popover';
import Tooltip from '../ui/Tooltip';

/** Blockers of `task` that are not finished yet. */
export function openBlockers(task, byId) {
  return (task.blockedBy ?? []).map((id) => byId[id]).filter((b) => b && !b.completedAt);
}

export function useTaskIndex() {
  const { tasks } = useProject();
  return useMemo(() => Object.fromEntries(tasks.map((t) => [t._id, t])), [tasks]);
}

/** Lock shown on cards and rows while a blocker is still open. */
export function BlockedIcon({ task, byId, className }) {
  const { t } = useTranslation();
  const { project } = useProject();
  const open = openBlockers(task, byId);
  if (!open.length || task.completedAt) return null;
  return (
    <Tooltip label={t('deps.blockedBy', { keys: open.map((b) => taskKey(project, b)).join(', ') })}>
      <span className={clsx('inline-flex items-center text-[#e2445c]', className)} data-testid="blocked">
        <Lock className="h-3.5 w-3.5" />
      </span>
    </Tooltip>
  );
}

function TaskLine({ task, onRemove, onOpen }) {
  const { t } = useTranslation();
  const { project } = useProject();
  return (
    <li className="group flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
      {task.completedAt ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00c875]" /> : <Lock className="h-4 w-4 shrink-0 text-[#e2445c]" />}
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-brand" onClick={() => onOpen(task._id)}>
        <span className="font-mono text-[11px] font-semibold text-muted">{taskKey(project, task)}</span>
        <span className={clsx('truncate', task.completedAt && 'text-muted line-through')}>{task.title}</span>
      </button>
      {onRemove && (
        <button type="button" className="btn-icon h-6 w-6 opacity-60 hover:opacity-100" onClick={onRemove} aria-label={t('deps.remove')}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function TaskSearch({ exclude, onSelect, close }) {
  const { t } = useTranslation();
  const { project, tasks } = useProject();
  const [q, setQ] = useState('');
  const input = useRef(null);
  // autoFocus would scroll the page while the menu is still off screen, which closes it
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const query = q.trim().toLowerCase();
  const list = tasks
    .filter((x) => !exclude.has(x._id))
    .filter((x) => !query || x.title.toLowerCase().includes(query) || taskKey(project, x).toLowerCase().includes(query))
    .slice(0, 30);
  return (
    <div className="space-y-1">
      <input ref={input} className="input h-9" placeholder={t('deps.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-64 overflow-y-auto">
        {list.map((x) => (
          <li key={x._id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              onClick={() => {
                onSelect(x._id);
                close();
              }}
            >
              <TypeIcon type={x.type} className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-muted">{taskKey(project, x)}</span>
              <span className="truncate">{x.title}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted">{t('deps.noMatch')}</li>}
      </ul>
    </div>
  );
}

/** "Blocked by" and "Blocks" sections of the task drawer. */
export default function Dependencies({ task }) {
  const { t } = useTranslation();
  // The drawer lives outside the views' outlet: open a task through the URL
  const [, setSearchParams] = useSearchParams();
  const onOpen = (id) =>
    setSearchParams((params) => {
      params.set('task', id);
      return params;
    });
  const { tasks, updateTask } = useProject();
  const byId = useTaskIndex();
  const blockers = (task.blockedBy ?? []).map((id) => byId[id]).filter(Boolean);
  const blocks = tasks.filter((x) => x.blockedBy?.includes(task._id));
  const exclude = new Set([task._id, ...(task.blockedBy ?? [])]);
  const setBlockers = (ids) => updateTask(task._id, { blockedBy: ids });

  return (
    <section className="space-y-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label mb-0">{t('deps.title')}</h3>
          <Popover
            width={320}
            trigger={({ toggle, ref }) => (
              <button ref={ref} type="button" className="btn-ghost h-7 px-2 text-xs" onClick={toggle} data-testid="add-blocker">
                <Plus className="h-3.5 w-3.5" /> {t('deps.add')}
              </button>
            )}
          >
            {({ close }) => <TaskSearch exclude={exclude} close={close} onSelect={(id) => setBlockers([...(task.blockedBy ?? []), id])} />}
          </Popover>
        </div>
        {blockers.length === 0 ? (
          <p className="text-xs text-muted">{t('deps.none')}</p>
        ) : (
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <TaskLine key={b._id} task={b} onOpen={onOpen} onRemove={() => setBlockers(task.blockedBy.filter((id) => id !== b._id))} />
            ))}
          </ul>
        )}
      </div>
      {blocks.length > 0 && (
        <div>
          <h3 className="label">{t('deps.blocks')}</h3>
          <ul className="space-y-1.5">
            {blocks.map((b) => (
              <TaskLine key={b._id} task={b} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
