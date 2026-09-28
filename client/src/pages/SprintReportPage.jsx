import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { api, errorMessage } from '../lib/api';
import { useStatuses } from '../hooks/useStatuses';
import { formatDate, taskKey } from '../lib/format';
import { EmptyState, PageLoader } from '../components/ui/Feedback';
import LogoMark from '../components/ui/LogoMark';

/*
 * Printable sprint report. Always light, whatever the app theme, so the PDF
 * (browser "Save as PDF") looks like a document.
 */
const long = { day: 'numeric', month: 'long', year: 'numeric' };

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[#e6e9ef] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676879]">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-[#676879]">{hint}</p>}
    </div>
  );
}

function TaskTable({ title, tasks, project, statusMap, t }) {
  if (!tasks.length) return null;
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 text-sm font-bold">
        {title} ({tasks.length})
      </h3>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#e6e9ef] text-[11px] uppercase tracking-wide text-[#676879]">
            <th className="py-1.5 pr-2 font-semibold">{t('csv.key')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('task.title')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('task.status')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('task.assignee')}</th>
            <th className="py-1.5 text-right font-semibold">{t('common.points')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task._id} className="border-b border-[#f0f1f5] align-top">
              <td className="whitespace-nowrap py-1.5 pr-2 font-mono text-[11px] text-[#676879]">{taskKey(project, task)}</td>
              <td className="py-1.5 pr-2">{task.title}</td>
              <td className="whitespace-nowrap py-1.5 pr-2">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: statusMap[task.status]?.color }} />
                {statusMap[task.status]?.name}
              </td>
              <td className="whitespace-nowrap py-1.5 pr-2">{task.assignee?.name ?? t('common.unassigned')}</td>
              <td className="py-1.5 text-right font-semibold">{task.points || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Report() {
  const { t } = useTranslation();
  const { project, sprints, tasks, loading, error } = useProject();
  const { map: statusMap } = useStatuses();
  const [params, setParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const started = sprints.filter((s) => s.status !== 'planned');
  const sprint = started.find((s) => s._id === params.get('sprint')) ?? started.find((s) => s.status === 'active') ?? started.at(-1);

  useEffect(() => {
    if (!project || !sprint) return;
    api.get(`/projects/${project._id}/stats`, { params: { sprint: sprint._id } }).then(({ data }) => setStats(data));
  }, [project, sprint]);

  const sprintTasks = useMemo(() => (sprint ? tasks.filter((x) => x.sprint === sprint._id) : []), [tasks, sprint]);
  useEffect(() => {
    if (project && sprint) document.title = `${project.name}, ${sprint.name}, ScrumFlow`;
  }, [project, sprint]);

  if (loading && !project) return <PageLoader />;
  if (error && !project) return <EmptyState illustration="error" title={errorMessage(error)} />;
  if (!sprint) return <EmptyState illustration="sprint" title={t('report.noSprint')} action={<Link to={`/projects/${project._id}`} className="btn-primary">{t('common.back')}</Link>} />;

  const done = sprintTasks.filter((x) => x.completedAt);
  const open = sprintTasks.filter((x) => !x.completedAt);
  const sum = (list) => list.reduce((s, x) => s + (x.points || 0), 0);
  const committed = sprint.status === 'completed' ? Math.max(sprint.committedPoints, sum(sprintTasks)) : sum(sprintTasks);
  const completed = sum(done);
  const people = Object.values(
    done.reduce((acc, x) => {
      const id = x.assignee?._id ?? 'none';
      acc[id] ??= { name: x.assignee?.name ?? t('common.unassigned'), tasks: 0, points: 0 };
      acc[id].tasks += 1;
      acc[id].points += x.points || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.points - a.points);
  const chart = stats?.burndown?.points.map((p) => ({ ...p, label: formatDate(p.date) }));
  const retro = sprint.retro ?? [];

  return (
    <div className="min-h-screen bg-[#f5f6f8] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[820px] flex-wrap items-center gap-2 px-4 print:hidden">
        <Link to={`/projects/${project._id}/dashboard`} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Link>
        {started.length > 1 && (
          <select className="input h-9 w-auto" value={sprint._id} onChange={(e) => setParams({ sprint: e.target.value })} aria-label={t('dashboard.pickSprint')}>
            {started.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-primary ml-auto" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t('report.pdf')}
        </button>
      </div>

      <article className="mx-auto max-w-[820px] space-y-6 rounded-2xl bg-white p-8 text-[#323338] shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none" data-testid="report">
        <header className="flex items-start gap-3 border-b border-[#e6e9ef] pb-4">
          <LogoMark className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#676879]">{t('report.title')}</p>
            <h1 className="text-2xl font-extrabold">
              {project.name}, {sprint.name}
            </h1>
            <p className="text-sm text-[#676879]">
              {formatDate(sprint.startDate, long)} → {formatDate(sprint.endDate, long)}
              {sprint.status === 'active' ? `, ${t('report.inProgress')}` : ''}
            </p>
          </div>
          <p className="text-right text-xs text-[#676879]">{t('report.generated', { date: formatDate(new Date(), long) })}</p>
        </header>

        {sprint.goal && (
          <p className="rounded-xl bg-[#6161ff]/5 px-4 py-3 text-sm">
            <span className="font-bold text-[#6161ff]">{t('report.goal')} </span>
            {sprint.goal}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={t('dashboard.committed')} value={committed} hint={t('common.pointsLong')} />
          <Kpi label={t('dashboard.completed')} value={completed} hint={t('common.pointsLong')} />
          <Kpi label={t('report.pointsDone')} value={`${committed ? Math.round((completed / committed) * 100) : 0}%`} />
          <Kpi label={t('report.tasksDone')} value={`${done.length}/${sprintTasks.length}`} />
        </div>

        {chart && (
          <section className="break-inside-avoid">
            <h3 className="mb-2 text-sm font-bold">{t('dashboard.burndown')}</h3>
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e6e9ef" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#676879' }} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={{ fontSize: 11, fill: '#676879' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Line isAnimationActive={false} dataKey="ideal" name={t('dashboard.ideal')} stroke="#9699a6" strokeDasharray="5 5" dot={false} />
                  <Line isAnimationActive={false} dataKey="remaining" name={t('dashboard.remaining')} stroke="#6161ff" strokeWidth={2.5} dot={{ r: 2.5 }} />
                  <Line isAnimationActive={false} dataKey="done" name={t('dashboard.doneWork')} stroke="#00c875" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {people.length > 0 && (
          <section className="break-inside-avoid">
            <h3 className="mb-2 text-sm font-bold">{t('report.byPerson')}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.name} className="flex justify-between rounded-lg border border-[#e6e9ef] px-3 py-2 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[#676879]">{t('report.personLine', { count: p.tasks, points: p.points })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <TaskTable title={t('report.completedTasks')} tasks={done} project={project} statusMap={statusMap} t={t} />
        <TaskTable title={sprint.status === 'active' ? t('report.openTasks') : t('report.leftTasks')} tasks={open} project={project} statusMap={statusMap} t={t} />

        {retro.some((i) => i.column === 'actions') && (
          <section className="break-inside-avoid">
            <h3 className="mb-2 text-sm font-bold">{t('report.actions')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {retro
                .filter((i) => i.column === 'actions')
                .map((i) => (
                  <li key={i._id}>{i.text}</li>
                ))}
            </ul>
          </section>
        )}
        <footer className="border-t border-[#e6e9ef] pt-3 text-center text-[11px] text-[#9699a6]">ScrumFlow</footer>
      </article>
    </div>
  );
}

export default function SprintReportPage() {
  const { projectId } = useParams();
  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <Report />
    </ProjectProvider>
  );
}
