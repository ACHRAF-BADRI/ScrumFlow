import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';
import { toastError } from '../lib/api';
import { CATEGORIES, DEFAULT_STATUSES, useStatuses } from '../hooks/useStatuses';
import { Popover } from './ui/Popover';
import Tooltip from './ui/Tooltip';

const COLORS = ['#a1a3b8', '#579bfc', '#6161ff', '#a25ddc', '#ff158a', '#e2445c', '#ff642e', '#fdab3d', '#ffcb00', '#00c875', '#037f4c', '#333333'];
const DEFAULT_KEYS = DEFAULT_STATUSES.map((s) => s.key);
const MAX = 12;

/** Board columns of the project: names, colors, order and "done" category. */
export default function WorkflowEditor() {
  const { t } = useTranslation();
  const { project, tasks, updateProject, reload } = useProject();
  const { list: current } = useStatuses();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const reset = () => setRows(current.map(({ key, label, color, category, wipLimit }) => ({ key, label, color, category, wipLimit: wipLimit || 0 })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [project?.statuses]);

  const counts = useMemo(() => {
    const out = {};
    for (const task of tasks) out[task.status] = (out[task.status] ?? 0) + 1;
    return out;
  }, [tasks]);

  const set = (index, changes) => setRows((list) => list.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  const move = (index, dir) =>
    setRows((list) => {
      const next = [...list];
      [next[index], next[index + dir]] = [next[index + dir], next[index]];
      return next;
    });
  const remove = (index) => setRows((list) => list.filter((_, i) => i !== index));
  const add = () => setRows((list) => [...list, { key: undefined, label: '', color: COLORS[list.length % COLORS.length], category: 'in_progress', wipLimit: 0 }]);

  // Where the tasks of a removed status will go (same rule as the API)
  const removed = current.filter((c) => !rows.some((r) => r.key === c.key));
  const destination = (category) => {
    const target = rows.find((r) => r.category === category) ?? rows[0];
    return target?.label || (target && DEFAULT_KEYS.includes(target.key) ? t(`status.${target.key}`) : '');
  };

  const problems = [];
  if (rows.length < 2) problems.push(t('workflow.errorCount'));
  if (!rows.some((r) => r.category === 'done') || !rows.some((r) => r.category !== 'done')) problems.push(t('workflow.errorDone'));
  if (rows.some((r) => !r.label.trim() && !DEFAULT_KEYS.includes(r.key))) problems.push(t('workflow.errorName'));

  const dirty = JSON.stringify(rows) !== JSON.stringify(current.map(({ key, label, color, category, wipLimit }) => ({ key, label, color, category, wipLimit: wipLimit || 0 })));

  const save = async () => {
    setSaving(true);
    try {
      await updateProject({ statuses: rows.map((r) => ({ ...r, label: r.label.trim() })) });
      await reload(); // tasks may have moved to another status
      toast.success(t('workflow.saved'));
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Workflow className="h-4 w-4 text-brand" /> {t('workflow.title')}
      </h3>
      <p className="mb-4 mt-1 text-xs text-muted">{t('workflow.text')}</p>

      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.key ?? `new-${index}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
            <div className="flex min-w-[12rem] flex-1 items-center gap-2">
              <Popover
                width={188}
                trigger={({ toggle, ref }) => (
                  <button ref={ref} type="button" onClick={toggle} className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/10" style={{ background: row.color }} aria-label={t('projects.color')} />
                )}
              >
                {({ close }) => (
                  <div className="grid grid-cols-6 gap-1.5 p-1">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          set(index, { color });
                          close();
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md"
                        style={{ background: color }}
                        aria-label={color}
                      >
                        {row.color === color && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
              <input
                className="input h-8 min-w-0 flex-1 py-0"
                value={row.label}
                maxLength={30}
                placeholder={DEFAULT_KEYS.includes(row.key) ? t(`status.${row.key}`) : t('workflow.namePlaceholder')}
                onChange={(e) => set(index, { label: e.target.value })}
                aria-label={t('workflow.name')}
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <select className="input h-8 w-auto py-0 text-xs" value={row.category} onChange={(e) => set(index, { category: e.target.value })} aria-label={t('workflow.category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`workflow.cat.${c}`)}
                  </option>
                ))}
              </select>
              <Tooltip label={t('wip.hint')}>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="input h-8 w-16 px-2 py-0 text-xs"
                  value={row.wipLimit || ''}
                  placeholder={t('wip.max')}
                  onChange={(e) => set(index, { wipLimit: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })}
                  aria-label={t('wip.max')}
                />
              </Tooltip>
              <span className="hidden w-14 shrink-0 text-right text-[11px] text-muted sm:inline">{t('workflow.tasks', { count: counts[row.key] ?? 0 })}</span>
              <div className="flex shrink-0">
                <button type="button" className="btn-icon h-8 w-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('workflow.up')}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon h-8 w-7" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={t('workflow.down')}>
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Tooltip label={t('common.delete')}>
                  <button type="button" className="btn-icon h-8 w-7 hover:text-[#e2445c]" disabled={rows.length <= 2} onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-ghost mt-2 px-2" onClick={add} disabled={rows.length >= MAX}>
        <Plus className="h-4 w-4" /> {t('workflow.add')}
      </button>

      {removed.some((r) => counts[r.key]) && (
        <ul className="mt-3 space-y-1 rounded-xl bg-[#fdab3d]/10 p-3 text-xs">
          {removed
            .filter((r) => counts[r.key])
            .map((r) => (
              <li key={r.key}>{t('workflow.moveWarning', { count: counts[r.key], from: r.name, to: destination(r.category) })}</li>
            ))}
        </ul>
      )}
      {problems.length > 0 && dirty && (
        <ul className="mt-3 space-y-1 text-xs text-[#e2445c]">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={clsx('btn-secondary', !dirty && 'invisible')} onClick={reset}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={!dirty || saving || problems.length > 0}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </section>
  );
}
