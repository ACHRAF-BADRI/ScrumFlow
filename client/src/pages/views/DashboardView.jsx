import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, ListTodo, Zap } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { api, toastError } from '../../lib/api';
import { useStatuses } from '../../hooks/useStatuses';
import { formatDate } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState, ProgressBar, Skeleton } from '../../components/ui/Feedback';
import ChartTooltip from '../../components/ui/ChartTooltip';

function StatCard({ icon: Icon, color, label, value, hint }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11" style={{ background: `${color}1f`, color }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-2xl font-extrabold leading-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function Panel({ title, children, className = '', action }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ text }) {
  return (
    <div className="flex h-60 items-center justify-center">
      <EmptyState compact illustration="chart" title={text} className="py-0" />
    </div>
  );
}

export default function DashboardView() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { project, tasks, memberById } = useProject();
  const { list: statuses } = useStatuses();
  const [stats, setStats] = useState(null);
  const [flow, setFlow] = useState(null);
  const [sprintId, setSprintId] = useState('');

  // Refetch when tasks change so the charts follow edits made in other views
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/projects/${project._id}/stats`, { params: { sprint: sprintId || undefined } }), api.get(`/projects/${project._id}/flow`, { params: { days: 30 } })])
      .then(([s, f]) => {
        if (cancelled) return;
        setStats(s.data);
        setFlow(f.data.days);
      })
      .catch(toastError);
    return () => {
      cancelled = true;
    };
  }, [project._id, tasks, sprintId]);

  if (!stats) {
    return (
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
        <Skeleton className="h-80 sm:col-span-2" />
        <Skeleton className="h-80 sm:col-span-2" />
      </div>
    );
  }

  const axis = { stroke: isDark ? '#9da0b9' : '#676879', fontSize: 12 };
  const grid = isDark ? '#3c3e56' : '#e6e9ef';

  const { totals } = stats;
  const completion = totals.tasks ? Math.round((totals.done / totals.tasks) * 100) : 0;
  const statusData = statuses.map((s) => ({ name: s.name, value: stats.byStatus[s.key] ?? 0, color: s.color })).filter((d) => d.value);
  const workload = Object.entries(stats.byAssignee)
    .map(([id, w]) => ({ id, user: id === 'unassigned' ? null : memberById[id], ...w }))
    .sort((a, b) => b.total - a.total);
  const burndown = stats.burndown?.points.map((p) => ({ ...p, label: formatDate(p.date) }));
  const flowData = flow?.map((d) => ({ ...d, label: formatDate(d.date) }));
  const hasFlow = flowData?.some((d) => statuses.some((s) => d[s.key] > 0));
  const sprintPicker =
    stats.sprints?.length > 1 ? (
      <select
        className="input h-8 w-auto max-w-[12rem] py-0 text-xs"
        value={stats.burndown?.sprintId ?? ''}
        onChange={(e) => setSprintId(e.target.value)}
        aria-label={t('dashboard.pickSprint')}
      >
        {stats.sprints.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
            {s.status === 'active' ? ` (${t('dashboard.activeShort')})` : ''}
          </option>
        ))}
      </select>
    ) : null;
  const reportLink = stats.burndown && (
    <Link to={`/projects/${project._id}/report?sprint=${stats.burndown.sprintId}`} className="btn-ghost h-8 px-2 text-xs">
      <FileText className="h-3.5 w-3.5" /> {t('report.open')}
    </Link>
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={ListTodo} color="#6161ff" label={t('dashboard.totalTasks')} value={totals.tasks} hint={t('dashboard.inBacklog', { count: totals.backlog })} />
        <StatCard icon={CheckCircle2} color="#00c875" label={t('dashboard.completion')} value={`${completion}%`} hint={`${totals.done} / ${totals.tasks}`} />
        <StatCard icon={Zap} color="#fdab3d" label={t('dashboard.storyPoints')} value={totals.donePoints} hint={`/ ${totals.points} ${t('common.points')}`} />
        <StatCard icon={AlertTriangle} color="#e2445c" label={t('dashboard.overdue')} value={totals.overdue} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={`${t('dashboard.burndown')}${stats.burndown && !sprintPicker ? ` · ${stats.burndown.sprint}` : ''}`}
          action={
            <>
              {sprintPicker}
              {reportLink}
            </>
          }
        >
          {burndown ? (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={burndown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: grid }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="linear" dataKey="ideal" name={t('dashboard.ideal')} stroke={axis.stroke} strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                  <Line type="linear" dataKey="remaining" name={t('dashboard.remaining')} stroke="#6161ff" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty text={t('dashboard.burndownEmpty')} />
          )}
        </Panel>

        <Panel title={`${t('dashboard.burnup')}${stats.burndown ? ` · ${stats.burndown.sprint}` : ''}`}>
          {burndown ? (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={burndown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: grid }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="stepAfter" dataKey="scope" name={t('dashboard.scope')} stroke="#fdab3d" strokeWidth={2} dot={false} />
                  <Line type="linear" dataKey="done" name={t('dashboard.doneWork')} stroke="#00c875" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty text={t('dashboard.burndownEmpty')} />
          )}
        </Panel>

        <Panel title={t('dashboard.flow')}>
          {hasFlow ? (
            <div className="h-64" data-testid="flow-chart">
              <ResponsiveContainer>
                <AreaChart data={flowData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: grid }} />
                  {/* Done at the bottom, like a classic cumulative flow diagram */}
                  {[...statuses].reverse().map((s) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="flow" stroke={s.color} fill={s.color} fillOpacity={0.55} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty text={t('dashboard.noData')} />
          )}
        </Panel>

        <Panel title={t('dashboard.velocity')}>
          {stats.velocity.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={stats.velocity} maxBarSize={48} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sprint" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#ffffff0d' : '#0000000a' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="committed" name={t('dashboard.committed')} fill={isDark ? '#4b4e6d' : '#c5c7d4'} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="completed" name={t('dashboard.completed')} fill="#00c875" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty text={t('dashboard.velocityEmpty')} />
          )}
        </Panel>

        <Panel title={t('dashboard.byStatus')}>
          {statusData.length ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                      {statusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip hideLabel />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2">
                {statusData.map((d) => (
                  <li key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded" style={{ background: d.color }} />
                    <span className="flex-1">{d.name}</span>
                    <span className="font-bold">{d.value}</span>
                    <span className="w-10 text-right text-xs text-muted">{Math.round((d.value / totals.tasks) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ChartEmpty text={t('dashboard.noData')} />
          )}
        </Panel>

        <Panel title={t('dashboard.workload')}>
          <ul className="space-y-3.5">
            {workload.map((w) => (
              <li key={w.id} className="flex items-center gap-3">
                <Avatar user={w.user} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{w.user?.name ?? t('common.unassigned')}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {w.done}/{w.total} {t('dashboard.tasks')} · {w.points} {t('common.points')}
                    </span>
                  </div>
                  <ProgressBar value={w.total ? (w.done / w.total) * 100 : 0} color={w.user?.avatarColor ?? '#a1a3b8'} />
                </div>
              </li>
            ))}
            {workload.length === 0 && <ChartEmpty text={t('dashboard.noData')} />}
          </ul>
        </Panel>

        {stats.epics?.length > 0 && (
          <Panel title={t('epics.title')} className="lg:col-span-2">
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {stats.epics.map((epic) => (
                <li key={epic._id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-[11px] text-muted">{epic.key}</span>
                      <span className="truncate font-semibold">{epic.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{t('epics.progress', { done: epic.done, total: epic.total, points: epic.donePoints, totalPoints: epic.points })}</span>
                  </div>
                  <ProgressBar value={epic.total ? (epic.done / epic.total) * 100 : 0} color="#a25ddc" />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
