import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Bookmark, BookmarkPlus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';
import { api, toastError } from '../lib/api';
import { PRIORITIES, TYPES } from '../lib/constants';
import { TypeIcon } from './ui/Badge';
import { Popover } from './ui/Popover';

export const EMPTY_FILTERS = { search: '', assignee: null, epic: null, priority: null, type: null, label: null };
export const hasFilters = (f) => Object.entries(f).some(([, v]) => v);

function Chip({ active, onClick, children, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
        active ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand/50 hover:text-ink'
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

/** Priority, type and label filters, in one menu. */
export function MoreFilters({ filters, setFilters }) {
  const { t } = useTranslation();
  const { tasks } = useProject();
  const labels = useMemo(() => [...new Set(tasks.flatMap((x) => x.labels ?? []))].sort().slice(0, 40), [tasks]);
  const count = ['priority', 'type', 'label'].filter((k) => filters[k]).length;
  const toggle = (key, value) => setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  return (
    <Popover
      width={300}
      trigger={({ toggle: open, ref }) => (
        <button ref={ref} type="button" onClick={open} className={clsx('btn-secondary h-9', count && 'border-brand text-brand')} data-testid="more-filters">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t('filters.more')}</span>
          {count > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{count}</span>}
        </button>
      )}
    >
      <div className="space-y-3 p-1.5">
        <div>
          <p className="label">{t('task.priority')}</p>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Chip key={p.id} color={p.color} active={filters.priority === p.id} onClick={() => toggle('priority', p.id)}>
                {t(`priority.${p.id}`)}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="label">{t('task.type')}</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((type) => (
              <Chip key={type.id} active={filters.type === type.id} onClick={() => toggle('type', type.id)}>
                <TypeIcon type={type.id} className="h-3 w-3" />
                {t(`type.${type.id}`)}
              </Chip>
            ))}
          </div>
        </div>
        {labels.length > 0 && (
          <div>
            <p className="label">{t('task.labels')}</p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {labels.map((label) => (
                <Chip key={label} active={filters.label === label} onClick={() => toggle('label', label)}>
                  #{label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
}

/** Personal saved filter sets for this project. */
export function SavedViews({ filters, setFilters }) {
  const { t } = useTranslation();
  const { project } = useProject();
  const [saved, setSaved] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/me/filters', { params: { project: project._id } })
      .then(({ data }) => alive && setSaved(data.filters))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project._id]);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const { data } = await api.post('/me/filters', { project: project._id, name, filters });
      setSaved(data.filters);
      setName('');
      toast.success(t('filters.viewSaved'));
    } catch (err) {
      toastError(err);
    }
  };
  const remove = async (id) => {
    try {
      const { data } = await api.delete(`/me/filters/${id}`);
      setSaved(data.filters);
    } catch (err) {
      toastError(err);
    }
  };
  const same = (a) => Object.keys(EMPTY_FILTERS).every((k) => (a[k] ?? EMPTY_FILTERS[k] ?? null) === (filters[k] || null));

  return (
    <Popover
      width={280}
      trigger={({ toggle, ref }) => (
        <button ref={ref} type="button" onClick={toggle} className="btn-secondary h-9" data-testid="saved-views">
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">{t('filters.views')}</span>
        </button>
      )}
    >
      {({ close }) => (
        <div className="space-y-2">
          {saved.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">{t('filters.noViews')}</p>
          ) : (
            <ul>
              {saved.map((view) => (
                <li key={view._id} className="group flex items-center">
                  <button
                    type="button"
                    className={clsx('menu-item flex-1', same(view.filters) && 'text-brand')}
                    onClick={() => {
                      setFilters({ ...EMPTY_FILTERS, ...view.filters });
                      close();
                    }}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="truncate">{view.name}</span>
                  </button>
                  <button type="button" className="btn-icon h-7 w-7 opacity-60 hover:text-[#e2445c] hover:opacity-100" onClick={() => remove(view._id)} aria-label={t('common.delete')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={save} className="flex gap-1.5 border-t border-line pt-2">
            <input className="input h-8 text-xs" placeholder={t('filters.viewName')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} disabled={!hasFilters(filters)} />
            <button type="submit" className="btn-primary h-8 px-2" disabled={!name.trim() || !hasFilters(filters)} aria-label={t('filters.saveView')}>
              <BookmarkPlus className="h-4 w-4" />
            </button>
          </form>
          {!hasFilters(filters) && <p className="px-1 text-[11px] text-muted">{t('filters.viewHint')}</p>}
        </div>
      )}
    </Popover>
  );
}
