import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarDays, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../lib/api';
import { resolveStatuses } from '../hooks/useStatuses';
import { formatDate, isOverdue } from '../lib/format';
import { Avatar } from '../components/ui/Avatar';
import { LabelChip, PriorityBadge, TypeIcon } from '../components/ui/Badge';
import { EmptyState, PageLoader, ProgressBar } from '../components/ui/Feedback';
import LogoMark from '../components/ui/LogoMark';
import BackToTop from '../components/ui/BackToTop';
import { LanguageSwitcher, ThemeToggle } from '../components/layout/Preferences';

/** Read-only board opened from a public link: no account, no editing. */
export default function SharedBoardPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/public/${token}`)
      .then(({ data: body }) => setData(body))
      .catch(setError);
  }, [token]);

  useEffect(() => {
    if (data) document.title = `${data.project.name}, ScrumFlow`;
  }, [data]);

  if (error) {
    return (
      <EmptyState
        illustration="notFound"
        title={errorMessage(error)}
        text={t('share.goneText')}
        action={
          <Link to="/" className="btn-primary">
            {t('share.discover')}
          </Link>
        }
      />
    );
  }
  if (!data) return <PageLoader />;

  const { project, sprint, tasks } = data;
  const statuses = resolveStatuses(project.statuses, t);
  const key = (task) => `${project.key}-${task.number}`;
  const total = tasks.reduce((s, x) => s + (x.points || 0), 0);
  const done = tasks.filter((x) => x.completedAt).reduce((s, x) => s + (x.points || 0), 0);

  return (
    <div className="min-h-screen bg-canvas" key={i18n.language}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="ScrumFlow">
          <LogoMark className="h-8 w-8" />
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">ScrumFlow</span>
        </Link>
        <span className="ml-2 flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">
          <Eye className="h-3.5 w-3.5" /> {t('share.readOnly')}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b border-line bg-surface px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: project.color }}>
            {project.key.slice(0, 3)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold sm:text-2xl">{project.name}</h1>
            <p className="text-sm text-muted">
              {sprint ? (
                <>
                  {sprint.name} · {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
                </>
              ) : (
                t('share.backlog')
              )}
            </p>
          </div>
          {sprint && (
            <div className="w-full max-w-[220px]">
              <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
                <span>{t('sprint.progress')}</span>
                <span>
                  {done}/{total} {t('common.points')}
                </span>
              </div>
              <ProgressBar value={total ? (done / total) * 100 : 0} />
            </div>
          )}
        </div>
        {sprint?.goal && <p className="mt-3 text-sm">{sprint.goal}</p>}
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto px-4 py-5 sm:px-6" data-testid="shared-board">
        {statuses.map((status) => {
          const list = tasks.filter((x) => x.status === status.key);
          return (
            <section key={status.key} className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl bg-surface-2/70 sm:w-[272px] 2xl:w-auto 2xl:max-w-none 2xl:flex-1">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
                <h2 className="truncate text-sm font-bold">{status.name}</h2>
                <span className="rounded-full bg-surface px-2 text-xs font-bold text-muted">{list.length}</span>
              </div>
              <div className="mx-3 mb-2 h-0.5 rounded-full" style={{ background: status.color }} />
              <div className="flex min-h-[100px] flex-col gap-2 px-2 pb-2">
                {list.map((task) => (
                  <article key={key(task)} className="rounded-xl border border-line bg-surface p-3 shadow-card">
                    <div className="mb-2 flex items-center gap-1.5">
                      <TypeIcon type={task.type} className="h-3.5 w-3.5" />
                      <span className="font-mono text-[11px] font-semibold text-muted">{key(task)}</span>
                      {task.points > 0 && <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted">{task.points}</span>}
                    </div>
                    <p className={clsx('text-sm font-semibold leading-snug', task.completedAt && 'text-muted line-through')}>{task.title}</p>
                    {task.labels?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.labels.slice(0, 3).map((l) => (
                          <LabelChip key={l}>{l}</LabelChip>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      {task.dueDate && (
                        <span className={clsx('flex items-center gap-1 text-[11px] font-medium', isOverdue(task) ? 'text-[#e2445c]' : 'text-muted')}>
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      <Avatar user={task.assignee} size="sm" className="ml-auto" />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="pb-8 text-center text-xs text-muted">
        {t('share.footer')}{' '}
        <Link to="/register" className="font-semibold text-brand hover:underline">
          {t('share.cta')}
        </Link>
      </p>
      <BackToTop />
    </div>
  );
}
