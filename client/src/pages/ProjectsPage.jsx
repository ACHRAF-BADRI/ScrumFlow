import { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { AvatarStack } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ProgressBar, Skeleton } from '../components/ui/Feedback';

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
        </div>
        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{project.description || '—'}</p>
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
  const { openNewProject } = useOutletContext();

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
        <button type="button" className="btn-primary" onClick={openNewProject}>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p._id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
