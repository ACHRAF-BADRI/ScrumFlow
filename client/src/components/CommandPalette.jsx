import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CornerDownLeft, FolderKanban, Languages, ListTodo, Moon, Plus, Search, Sun, UserCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { TypeIcon } from './ui/Badge';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SHORTCUT = isMac ? '⌘K' : 'Ctrl K';

/** Global search and quick actions, opened with Ctrl/⌘ + K. */
export default function CommandPalette({ open, onClose, onNewProject }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { updateProfile } = useAuth();
  const { isDark, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  // `q` remembers which query these results answer, so stale ones are never shown
  const [results, setResults] = useState({ q: null, tasks: [], projects: [], allProjects: [] });
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const projectId = pathname.match(/^\/projects\/([a-f0-9]{24})/)?.[1];

  // Debounced search
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      api
        .get('/me/search', { params: { q: query } })
        .then(({ data }) => setResults({ q: query, tasks: data.tasks ?? [], projects: data.projects ?? [], allProjects: data.allProjects ?? data.projects ?? [] }))
        .catch(() => {});
    }, query ? 180 : 0);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const go = useCallback(
    (fn) => {
      onClose();
      fn();
    },
    [onClose]
  );

  const items = useMemo(() => {
    const keyOf = (task) => {
      const p = results.allProjects.find((x) => String(x._id) === String(task.project)) ?? results.projects.find((x) => String(x._id) === String(task.project));
      return p ? `${p.key}-${task.number}` : `#${task.number}`;
    };
    const q = query.trim().toLowerCase();
    const actions = [
      projectId && { id: 'new-task', icon: Plus, label: t('palette.newTask'), run: () => navigate(`/projects/${projectId}?new=1`) },
      { id: 'new-project', icon: FolderKanban, label: t('nav.newProject'), run: onNewProject },
      { id: 'my-work', icon: ListTodo, label: t('nav.myWork'), run: () => navigate('/my-work') },
      { id: 'account', icon: UserCog, label: t('account.title'), run: () => navigate('/account') },
      {
        id: 'theme',
        icon: isDark ? Sun : Moon,
        label: isDark ? t('palette.lightTheme') : t('palette.darkTheme'),
        run: () => {
          const next = isDark ? 'light' : 'dark';
          setTheme(next);
          updateProfile({ theme: next });
        },
      },
      {
        id: 'language',
        icon: Languages,
        label: i18n.language?.startsWith('fr') ? 'Switch to English' : 'Passer en français',
        run: () => {
          const next = i18n.language?.startsWith('fr') ? 'en' : 'fr';
          i18n.changeLanguage(next);
          updateProfile({ language: next });
        },
      },
    ]
      .filter(Boolean)
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({ ...a, section: 'actions' }));

    // While a new search is in flight, keep only what still matches the typed text
    const fresh = results.q === query;
    const tasks = fresh ? results.tasks : [];
    const projects = (fresh ? results.projects : results.allProjects).filter((p) => !q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
    return [
      ...tasks.map((task) => ({
        id: `task-${task._id}`,
        section: 'tasks',
        label: task.title,
        hint: keyOf(task),
        type: task.type,
        done: Boolean(task.completedAt),
        run: () => navigate(`/projects/${task.project}?task=${task._id}`),
      })),
      ...projects.map((p) => ({
        id: `project-${p._id}`,
        section: 'projects',
        label: p.name,
        hint: p.key,
        color: p.color,
        run: () => navigate(`/projects/${p._id}`),
      })),
      ...actions,
    ];
  }, [results, query, projectId, t, i18n, isDark, navigate, onNewProject, setTheme, updateProfile]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active].run);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const sections = ['tasks', 'projects', 'actions'];
  let index = -1;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('palette.title')} className="w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 shrink-0 text-muted" />
          <input
            autoFocus
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
            placeholder={t('palette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('palette.placeholder')}
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">Esc</kbd>
        </label>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">{t('palette.noResults')}</p>}
          {sections.map((section) => {
            const list = items.filter((i) => i.section === section);
            if (!list.length) return null;
            return (
              <div key={section} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{t(`palette.${section}`)}</p>
                {list.map((item) => {
                  index += 1;
                  const i = index;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item.run)}
                      className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', i === active ? 'bg-brand/10 text-ink' : 'text-ink/90')}
                    >
                      {item.section === 'tasks' && <TypeIcon type={item.type} className="h-3.5 w-3.5" />}
                      {item.section === 'projects' && <span className="h-3 w-3 shrink-0 rounded" style={{ background: item.color }} />}
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted" />}
                      {item.hint && <span className="shrink-0 font-mono text-[11px] text-muted">{item.hint}</span>}
                      <span className={clsx('min-w-0 flex-1 truncate', item.done && 'text-muted line-through')}>{item.label}</span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2/50 px-4 py-2 text-[11px] text-muted">
          <span>↑ ↓ {t('palette.navigate')}</span>
          <span>↵ {t('palette.open')}</span>
          <span className="ml-auto">{SHORTCUT}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
