import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search, Star, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { useAutoTour } from '../components/tour/TourProvider';
import { AvatarStack } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ProgressBar, Skeleton } from '../components/ui/Feedback';
import Tooltip from '../components/ui/Tooltip';
import { useFavorites } from '../hooks/useFavorites';

// The search field only shows up once the list gets long
const SEARCH_FROM = 7;

function FavoriteStar({ project }) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(project._id);
  return (
    <Tooltip label={active ? t('projects.unfavorite') : t('projects.favorite')}>
      <button
        type="button"
        onClick={(e) => {
          // The card is a link: don't open the project
          e.preventDefault();
          e.stopPropagation();
          toggle(project._id);
        }}
        aria-pressed={active}
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
          active ? 'text-[#fdab3d] hover:bg-[#fdab3d]/10' : 'text-muted/60 opacity-100 hover:bg-surface-2 hover:text-[#fdab3d] sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
        )}
      >
        <Star className={clsx('h-[18px] w-[18px] transition-transform', active && 'scale-110')} fill={active ? 'currentColor' : 'none'} strokeWidth={2.2} />
      </button>
    </Tooltip>
  );
}

function ProjectCard({ project }) {
  const { t } = useTranslation();
  const { total, done } = project.stats ?? { total: 0, done: 0 };
  const members = project.members.map((m) => m.user).filter(Boolean);

  return (
    <Link to={`/projects/${project._id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="h-1.5" style={{ background: project.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white" style={{ background: project.color }}>
            {project.key.slice(0, 3)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold group-hover:text-brand">{project.name}</h3>
            <p className="text-xs text-muted">{t('projects.members', { count: members.length })}</p>
          </div>
          <FavoriteStar project={project} />
        </div>
        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{project.description}</p>
        <div className="mt-4">
          {project.activeSprint ? (
            <Badge color="#00c875" dot>
              {t('projects.activeSprint', { name: project.activeSprint.name })}
            </Badge>
          ) : (
            <Badge color="#a1a3b8">{t('projects.noActiveSprint')}</Badge>
          )}
        </div>
        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>{t('projects.tasksDone', { done, total })}</span>
            <span className="font-bold">{total ? Math.round((done / total) * 100) : 0}%</span>
          </div>
          <ProgressBar value={total ? (done / total) * 100 : 0} color={project.color} />
          <div className="mt-4">
            <AvatarStack users={members} max={5} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projects, loading, refresh } = useProjects();
  useAutoTour('home', !loading);
  const { openNewProject } = useOutletContext();
  const { sortFavoritesFirst } = useFavorites();
  const [query, setQuery] = useState('');
  const showSearch = projects.length >= SEARCH_FROM;

  const visible = useMemo(() => {
    const q = showSearch ? query.trim().toLowerCase() : '';
    const list = q
      ? projects.filter((p) => [p.name, p.key, p.description].some((v) => v?.toLowerCase().includes(q)))
      : projects;
    return sortFavoritesFirst(list);
  }, [projects, query, showSearch, sortFavoritesFirst]);

  // Fresh counts when coming back from a project
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Zap className="h-4 w-4" /> {t('auth.welcome', { name: user.name.split(' ')[0] })}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('projects.title')}</h1>
          <p className="text-sm text-muted">{t('projects.subtitle')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={openNewProject} data-tour="new-project">
          <Plus className="h-4 w-4" /> {t('nav.newProject')}
        </button>
      </div>

      {loading && projects.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            illustration="projects"
            title={t('projects.empty')}
            text={t('projects.emptyText')}
            action={
              <button type="button" className="btn-primary" onClick={openNewProject}>
                <Plus className="h-4 w-4" /> {t('projects.create')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          {showSearch && (
            <label className="relative mb-5 block max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input h-10 pl-9 pr-9" placeholder={t('projects.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label={t('common.clearFilters')}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          )}
          {visible.length === 0 ? (
            <div className="card">
              <EmptyState
                illustration="search"
                title={t('projects.noMatch', { query: query.trim() })}
                action={
                  <button type="button" className="btn-secondary" onClick={() => setQuery('')}>
                    <X className="h-4 w-4" /> {t('common.clearFilters')}
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
