import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Filter, History, KanbanSquare, LayoutDashboard, Plus, Search, Table2, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { errorMessage } from '../lib/api';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { EmptyState, PageLoader } from '../components/ui/Feedback';
import { OptionList, Popover } from '../components/ui/Popover';
import TaskDrawer from '../components/tasks/TaskDrawer';
import { useAutoTour } from '../components/tour/TourProvider';
import NewTaskModal from '../components/tasks/NewTaskModal';

const TABS = [
  { to: '', end: true, label: 'views.table', icon: Table2 },
  { to: 'board', label: 'views.board', icon: KanbanSquare, tour: 'tab-board' },
  { to: 'dashboard', label: 'views.dashboard', icon: LayoutDashboard },
  { to: 'history', label: 'views.history', icon: History },
  { to: 'team', label: 'views.team', icon: Users, tour: 'tab-team' },
];

function Filters({ filters, setFilters }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { members, memberById } = useProject();
  const active = filters.search || filters.assignee;
  const selected = filters.assignee === 'unassigned' ? null : memberById[filters.assignee];

  const options = [
    { value: null, label: t('filters.all') },
    { value: user._id, render: <span className="flex items-center gap-2"><Avatar user={user} size="xs" />{t('filters.myTasks')}</span> },
    { value: 'unassigned', render: <span className="flex items-center gap-2"><Avatar user={null} size="xs" />{t('common.unassigned')}</span> },
    ...members
      .filter((m) => m._id !== user._id)
      .map((m) => ({ value: m._id, render: <span className="flex items-center gap-2"><Avatar user={m} size="xs" />{m.name}</span> })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[10rem] flex-1 sm:max-w-xs sm:flex-none">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input h-9 pl-9"
          placeholder={t('common.search')}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
      </label>
      <Popover
        width={220}
        trigger={({ toggle, ref }) => (
          <button ref={ref} type="button" onClick={toggle} className={clsx('btn-secondary h-9', filters.assignee && 'border-brand text-brand')}>
            {filters.assignee ? <Avatar user={selected ?? null} size="xs" /> : <Filter className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {filters.assignee === user._id ? t('filters.myTasks') : filters.assignee === 'unassigned' ? t('common.unassigned') : selected?.name ?? t('filters.assignee')}
            </span>
          </button>
        )}
      >
        {({ close }) => <OptionList options={options} value={filters.assignee} onSelect={(assignee) => setFilters((f) => ({ ...f, assignee }))} close={close} />}
      </Popover>
      {active && (
        <button type="button" className="btn-ghost h-9 px-2.5" onClick={() => setFilters({ search: '', assignee: null })}>
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.clearFilters')}</span>
        </button>
      )}
    </div>
  );
}

function ProjectShell() {
  const { t } = useTranslation();
  const { project, members, loading, error, reload } = useProject();
  const location = useLocation();
  // The project tour explains the table view, so only start it there
  useAutoTour('project', Boolean(project) && !/\/(board|dashboard|history|team)$/.test(location.pathname));
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({ search: '', assignee: null });
  const [newTask, setNewTask] = useState(null); // null = closed, object = defaults

  const openTaskId = searchParams.get('task');
  const openTask = useCallback(
    (id) =>
      setSearchParams((params) => {
        params.set('task', id);
        return params;
      }),
    [setSearchParams]
  );
  const closeTask = useCallback(
    () =>
      setSearchParams((params) => {
        params.delete('task');
        return params;
      }),
    [setSearchParams]
  );

  const filterTasks = useCallback(
    (list) => {
      const q = filters.search.trim().toLowerCase();
      return list.filter((task) => {
        if (filters.assignee === 'unassigned' && task.assignee) return false;
        if (filters.assignee && filters.assignee !== 'unassigned' && task.assignee?._id !== filters.assignee) return false;
        if (!q) return true;
        return (
          task.title.toLowerCase().includes(q) ||
          `${project.key}-${task.number}`.toLowerCase().includes(q) ||
          task.labels?.some((l) => l.toLowerCase().includes(q))
        );
      });
    },
    [filters, project?.key]
  );

  const outletContext = useMemo(
    () => ({
      filterTasks,
      filtersActive: Boolean(filters.search || filters.assignee),
      clearFilters: () => setFilters({ search: '', assignee: null }),
      openTask,
      openNewTask: (defaults = {}) => setNewTask(defaults),
    }),
    [filterTasks, filters, openTask]
  );

  if (loading && !project) return <PageLoader />;
  if (error && !project) {
    return (
      <EmptyState
        illustration="error"
        title={errorMessage(error)}
        action={
          <div className="flex gap-2">
            <Link to="/" className="btn-secondary">
              {t('errors.goHome')}
            </Link>
            <button type="button" className="btn-primary" onClick={reload}>
              {t('common.retry')}
            </button>
          </div>
        }
      />
    );
  }

  const showFilters = !/\/(dashboard|history|team)$/.test(location.pathname);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-surface px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-sm" style={{ background: project.color }}>
            {project.key.slice(0, 3)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{project.name}</h1>
            {project.description && <p className="line-clamp-1 text-sm text-muted">{project.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Link to="team" className="hidden sm:block" aria-label={t('team.members')}>
              <AvatarStack users={members} max={5} size="md" />
            </Link>
            <button type="button" className="btn-primary" onClick={() => setNewTask({})} data-tour="new-task">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('task.new')}</span>
            </button>
          </div>
        </div>

        <nav className="scrollbar-none -mb-px mt-4 flex gap-1 overflow-x-auto" data-tour="view-tabs">
          {TABS.map(({ to, end, label, icon: Icon, tour }) => (
            <NavLink
              key={label}
              data-tour={tour}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {t(label)}
            </NavLink>
          ))}
        </nav>
      </div>

      {showFilters && (
        <div className="px-4 pt-4 sm:px-6">
          <div data-tour="filters" className="inline-block max-w-full">
            <Filters filters={filters} setFilters={setFilters} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <Outlet context={outletContext} />
      </div>

      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={closeTask} />}
      <NewTaskModal open={newTask !== null} defaults={newTask} onClose={() => setNewTask(null)} />
    </div>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams();
  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <ProjectShell />
    </ProjectProvider>
  );
}
