import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, CalendarDays, Coffee, Download, FileSpreadsheet, FileText, Spade, Filter, History, Zap, KanbanSquare, LayoutDashboard, Plus, Search, Table2, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { errorMessage } from '../lib/api';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { EmptyState, PageLoader } from '../components/ui/Feedback';
import { OptionList, Popover } from '../components/ui/Popover';
import TaskDrawer from '../components/tasks/TaskDrawer';
import { useEpics } from '../components/tasks/Epics';
import { useAutoTour } from '../components/tour/TourProvider';
import Tooltip from '../components/ui/Tooltip';
import NewTaskModal from '../components/tasks/NewTaskModal';
import ResponsiveTabs from '../components/layout/ResponsiveTabs';
import { EMPTY_FILTERS, MoreFilters, SavedViews, hasFilters } from '../components/SavedFilters';
import { downloadText, tasksToCsv } from '../lib/exportCsv';
import { useStatuses } from '../hooks/useStatuses';

const TABS = [
  { to: '', end: true, label: 'views.table', icon: Table2 },
  { to: 'board', label: 'views.board', icon: KanbanSquare, tour: 'tab-board' },
  { to: 'calendar', label: 'views.calendar', icon: CalendarDays },
  { to: 'standup', label: 'views.standup', icon: Coffee },
  { to: 'poker', label: 'views.poker', icon: Spade },
  { to: 'dashboard', label: 'views.dashboard', icon: LayoutDashboard },
  { to: 'activity', label: 'views.activity', icon: Activity },
  { to: 'history', label: 'views.history', icon: History },
  { to: 'team', label: 'views.team', icon: Users, tour: 'tab-team' },
];

function Filters({ filters, setFilters }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { members, memberById } = useProject();
  const active = hasFilters(filters);
  const { epics, byId: epicById } = useEpics();
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
      <label className="relative w-full sm:w-auto sm:min-w-[10rem] sm:max-w-xs sm:flex-none">
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
      {epics.length > 0 && (
        <Popover
          width={260}
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" onClick={toggle} className={clsx('btn-secondary h-9 max-w-[200px]', filters.epic && 'border-[#a25ddc] text-[#a25ddc]')}>
              <Zap className="h-4 w-4 shrink-0" />
              <span className="hidden truncate sm:inline">{filters.epic ? epicById[filters.epic]?.title : t('epics.filter')}</span>
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              options={[{ value: null, label: t('epics.all') }, ...epics.map((e) => ({ value: e._id, label: e.title }))]}
              value={filters.epic}
              onSelect={(epic) => setFilters((f) => ({ ...f, epic }))}
              close={close}
            />
          )}
        </Popover>
      )}
      <MoreFilters filters={filters} setFilters={setFilters} />
      <SavedViews filters={filters} setFilters={setFilters} />
      {active && (
        <button type="button" className="btn-ghost h-9 px-2.5" onClick={() => setFilters(EMPTY_FILTERS)}>
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.clearFilters')}</span>
        </button>
      )}
    </div>
  );
}

function ExportMenu({ filterTasks }) {
  const { t } = useTranslation();
  const { project, tasks, sprints, activeSprint } = useProject();
  const { map: statusMap } = useStatuses();
  const reportSprint = activeSprint ?? sprints.filter((s) => s.status === 'completed').at(-1);

  const csv = (list, suffix) => {
    const text = tasksToCsv({ tasks: list, project, sprints, statusMap, t });
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`${project.key}-${suffix}-${date}.csv`, text);
  };
  const filtered = filterTasks(tasks);

  return (
    <Popover
      width={260}
      align="end"
      trigger={({ toggle, ref }) => (
        <Tooltip label={t('export.title')}>
          <button ref={ref} type="button" className="btn-icon h-10 w-10" onClick={toggle} aria-label={t('export.title')} data-testid="export-menu">
            <Download className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <div>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              csv(tasks, 'tasks');
              close();
            }}
          >
            <FileSpreadsheet className="h-4 w-4 text-[#00c875]" /> {t('export.allCsv', { count: tasks.length })}
          </button>
          {filtered.length !== tasks.length && (
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                csv(filtered, 'filtered');
                close();
              }}
            >
              <FileSpreadsheet className="h-4 w-4 text-[#00c875]" /> {t('export.filteredCsv', { count: filtered.length })}
            </button>
          )}
          {reportSprint && (
            <Link to={`report?sprint=${reportSprint._id}`} className="menu-item" onClick={close}>
              <FileText className="h-4 w-4 text-[#e2445c]" /> {t('export.report', { name: reportSprint.name })}
            </Link>
          )}
        </div>
      )}
    </Popover>
  );
}

function ProjectShell() {
  const { t } = useTranslation();
  const { project, members, loading, error, reload, viewers } = useProject();
  const { user } = useAuth();
  const watching = viewers.filter((v) => v._id !== user._id);
  const location = useLocation();
  // The project tour explains the table view, so only start it there
  useAutoTour('project', Boolean(project) && !/\/(board|calendar|standup|poker|dashboard|activity|history|team)$/.test(location.pathname));
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [newTask, setNewTask] = useState(null); // null = closed, object = defaults

  const openTaskId = searchParams.get('task');
  // "New task" from the command palette arrives as ?new=1
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setNewTask({});
    setSearchParams(
      (params) => {
        params.delete('new');
        return params;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);
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
        if (filters.epic && task.epic !== filters.epic && task._id !== filters.epic) return false;
        if (filters.assignee === 'unassigned' && task.assignee) return false;
        if (filters.assignee && filters.assignee !== 'unassigned' && task.assignee?._id !== filters.assignee) return false;
        if (filters.priority && task.priority !== filters.priority) return false;
        if (filters.type && task.type !== filters.type) return false;
        if (filters.label && !task.labels?.includes(filters.label)) return false;
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
      filtersActive: hasFilters(filters),
      clearFilters: () => setFilters(EMPTY_FILTERS),
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

  const showFilters = !/\/(standup|poker|dashboard|activity|history|team)$|\/retro\//.test(location.pathname);

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
            {watching.length > 0 && (
              <div className="flex items-center gap-2" data-testid="viewers">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c875] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00c875]" />
                </span>
                <div className="flex -space-x-1.5">
                  {watching.slice(0, 4).map((v) => (
                    <Tooltip key={v._id} label={t('realtime.viewing', { name: v.name })}>
                      <span className="rounded-full ring-2 ring-[#00c875]">
                        <Avatar user={v} size="sm" />
                      </span>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
            <Link to="team" className="hidden sm:block" aria-label={t('team.members')}>
              <AvatarStack users={members} max={5} size="md" />
            </Link>
            <ExportMenu filterTasks={filterTasks} />
            <button type="button" className="btn-primary" onClick={() => setNewTask({})} data-tour="new-task">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('task.new')}</span>
            </button>
          </div>
        </div>

        <ResponsiveTabs tabs={TABS} />
      </div>

      {showFilters && (
        <div className="px-4 pt-4 sm:px-6">
          <div data-tour="filters" className="block max-w-full sm:inline-block">
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
