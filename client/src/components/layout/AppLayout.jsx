import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { WifiOff } from 'lucide-react';
import { useOnline } from '../../lib/pwa';
import { FolderKanban, LayoutGrid, ListTodo, Menu, Search, PanelLeftClose, PanelLeftOpen, Plus, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../context/ProjectsContext';
import { Skeleton } from '../ui/Feedback';
import LogoMark from '../ui/LogoMark';
import Tooltip from '../ui/Tooltip';
import { useFavorites } from '../../hooks/useFavorites';
import NewProjectModal from '../NewProjectModal';
import NotificationBell from './NotificationBell';
import CommandPalette, { SHORTCUT } from '../CommandPalette';
import { LanguageSwitcher, ThemeToggle, UserMenu } from './Preferences';

export function Logo({ className, compact, wordmarkClassName }) {
  return (
    <Link to="/" className={clsx('group flex items-center gap-2.5', className)} aria-label="ScrumFlow">
      <LogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_4px_10px_rgba(97,97,255,0.35)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      {!compact && (
        <span className={clsx('whitespace-nowrap text-[1.15rem] font-extrabold tracking-[-0.03em]', wordmarkClassName)}>
          Scrum
          <span className="bg-gradient-to-r from-[#8B7DFF] via-brand to-[#3B2FCB] bg-clip-text text-transparent dark:from-[#A99FFF] dark:via-[#8B7DFF] dark:to-[#6161FF]">Flow</span>
        </span>
      )}
    </Link>
  );
}

function Sidebar({ onNavigate, onNewProject, collapsed = false }) {
  const { t } = useTranslation();
  const { projects: allProjects, loading } = useProjects();
  const { isFavorite, sortFavoritesFirst } = useFavorites();
  const projects = sortFavoritesFirst(allProjects);

  const linkClass = ({ isActive }) =>
    clsx(
      'flex items-center rounded-lg text-sm font-medium transition',
      collapsed ? 'mx-auto h-10 w-10 justify-center' : 'gap-2.5 px-2.5 py-2',
      isActive ? 'bg-brand/10 text-brand' : 'text-ink/80 hover:bg-surface-2 hover:text-ink'
    );

  return (
    <nav className={clsx('flex min-h-0 flex-1 flex-col gap-1', collapsed ? 'px-2 py-3' : 'p-3')}>
      <Tooltip side="right" label={t('nav.projects')} disabled={!collapsed}>
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>
          <LayoutGrid className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && t('nav.projects')}
        </NavLink>
      </Tooltip>
      <Tooltip side="right" label={t('nav.myWork')} disabled={!collapsed}>
        <NavLink to="/my-work" className={linkClass} onClick={onNavigate} data-tour="nav-my-work">
          <ListTodo className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && t('nav.myWork')}
        </NavLink>
      </Tooltip>

      {collapsed ? (
        <div className="my-3 flex flex-col items-center gap-2">
          <div className="h-px w-8 bg-line" />
          <Tooltip side="right" label={t('nav.newProject')}>
            <button type="button" className="btn-icon h-8 w-8" onClick={onNewProject}>
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="mb-1 mt-5 flex items-center justify-between px-2.5">
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted">{t('nav.myProjects')}</span>
          <Tooltip label={t('nav.newProject')}>
            <button type="button" className="btn-icon h-7 w-7" onClick={onNewProject}>
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className={clsx('flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden', collapsed ? 'scrollbar-none' : '-mx-1 px-1')}>
        {loading &&
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className={collapsed ? 'mx-auto my-2 h-7 w-7' : 'mx-2.5 my-2 h-5'} />)}
        {projects.map((p) => (
          <Tooltip key={p._id} side="right" label={p.name} disabled={!collapsed}>
            <NavLink to={`/projects/${p._id}`} className={linkClass} onClick={onNavigate}>
              <span
                className={clsx('flex shrink-0 items-center justify-center rounded-md font-bold text-white', collapsed ? 'h-7 w-7 text-[11px]' : 'h-6 w-6 text-[10px]')}
                style={{ background: p.color }}
              >
                {p.key.slice(0, 2)}
              </span>
              {!collapsed && <span className="truncate">{p.name}</span>}
              {!collapsed && isFavorite(p._id) && <Star className="ml-auto h-3.5 w-3.5 shrink-0 text-[#fdab3d]" fill="currentColor" />}
            </NavLink>
          </Tooltip>
        ))}
        {!loading && projects.length === 0 && !collapsed && (
          <button type="button" onClick={onNewProject} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-surface-2">
            <FolderKanban className="h-4 w-4" />
            {t('nav.newProject')}
          </button>
        )}
      </div>
    </nav>
  );
}

const SIDEBAR_KEY = 'sf_sidebar_collapsed';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function useCollapsedSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  // Ctrl/Cmd + B, like VS Code and Notion
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        const el = document.activeElement;
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return [collapsed, setCollapsed];
}

/** Shown while the browser is offline: pages read from the last saved data. */
function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-[#fdab3d] px-4 py-1.5 text-center text-xs font-semibold text-[#323338]">
      <WifiOff className="h-3.5 w-3.5 shrink-0" /> {t('pwa.offline')}
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd + K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [collapsed, setCollapsed] = useCollapsedSidebar();
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const openNewProject = () => {
    setDrawerOpen(false);
    setNewProjectOpen(true);
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar-projects"
        className={clsx(
          'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className={clsx('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
          <Logo compact={collapsed} />
        </div>
        <Sidebar onNewProject={openNewProject} collapsed={collapsed} />
        <div className={clsx('shrink-0 border-t border-line', collapsed ? 'p-2' : 'p-3')}>
          <Tooltip side="right" label={`${t('nav.expand')} (${isMac ? '⌘' : 'Ctrl'}+B)`} disabled={!collapsed}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={clsx(
                'flex items-center rounded-lg text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink',
                collapsed ? 'mx-auto h-10 w-10 justify-center' : 'w-full gap-2.5 px-2.5 py-2'
              )}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              {!collapsed && (
                <>
                  <span className="min-w-0 truncate">{t('nav.collapse')}</span>
                  <kbd className="ml-auto shrink-0 whitespace-nowrap rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted">
                    {isMac ? '⌘' : 'Ctrl'} B
                  </kbd>
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-surface shadow-pop">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button type="button" className="btn-icon" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setDrawerOpen(false)} onNewProject={openNewProject} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
          <button type="button" className="btn-icon -ml-2 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label={t('nav.menu')}>
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="lg:hidden" wordmarkClassName="hidden sm:inline" />
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setPaletteOpen(true)} className="btn-ghost h-9 gap-2 px-2.5 sm:border sm:border-line sm:bg-surface sm:pr-2" aria-label={t('palette.title')}>
              <Search className="h-[18px] w-[18px]" />
              <span className="hidden text-sm font-medium md:inline">{t('palette.search')}</span>
              <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted sm:inline">{SHORTCUT}</kbd>
            </button>
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="ml-1.5">
              <UserMenu />
            </div>
          </div>
        </header>
        <OfflineBanner />
        <main className="min-w-0 flex-1">
          <Outlet context={{ openNewProject }} />
        </main>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewProject={openNewProject} />
    </div>
  );
}
