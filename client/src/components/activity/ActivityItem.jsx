import { Trans, useTranslation } from 'react-i18next';
import { useStatuses } from '../../hooks/useStatuses';
import { formatDate, formatDateTime, relativeTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import Tooltip from '../ui/Tooltip';

/** i18n key + values for one activity entry. */
function describe(a, t, statusMap) {
  const d = a.data ?? {};
  const base = { actor: a.actor?.name ?? a.actorName ?? t('activity.someone'), task: a.taskKey ?? '' };
  switch (a.type) {
    case 'task.updated': {
      const f = d.field;
      if (f === 'status') return ['activity.status', { ...base, to: statusMap[d.to]?.name ?? (d.toLabel || t(`status.${d.to}`, { defaultValue: d.to })) }];
      if (f === 'priority') return ['activity.priority', { ...base, to: t(`priority.${d.to}`) }];
      if (f === 'type') return ['activity.type', { ...base, to: t(`type.${d.to}`) }];
      if (f === 'assignee') return d.to ? ['activity.assigned', { ...base, to: d.to }] : ['activity.unassigned', base];
      if (f === 'sprint') return d.to ? ['activity.sprint', { ...base, to: d.to }] : ['activity.backlog', base];
      if (f === 'points') return ['activity.points', { ...base, to: d.to ?? 0 }];
      if (f === 'dueDate') return d.to ? ['activity.dueDate', { ...base, to: formatDate(d.to, { day: 'numeric', month: 'long' }) }] : ['activity.dueDateRemoved', base];
      if (f === 'title') return ['activity.renamed', { ...base, to: d.to }];
      return ['activity.description', base];
    }
    case 'task.created':
    case 'task.deleted':
    case 'task.commented':
      return [`activity.${a.type.split('.')[1]}`, base];
    case 'checklist.added':
    case 'checklist.checked':
    case 'checklist.unchecked':
      return [`activity.${a.type.replace('.', '_')}`, { ...base, text: d.text }];
    case 'sprint.created':
    case 'sprint.started':
    case 'sprint.deleted':
      return [`activity.${a.type.replace('.', '_')}`, { ...base, name: d.name }];
    case 'sprint.completed':
      return ['activity.sprint_completed', { ...base, name: d.name, count: d.moved ?? 0 }];
    case 'member.added':
    case 'member.role':
      return [`activity.${a.type.replace('.', '_')}`, { ...base, name: d.name, role: t(`invite.roleWord.${d.role}`, { defaultValue: d.role }) }];
    case 'member.removed':
    case 'member.left':
    case 'member.joined':
      return [`activity.${a.type.replace('.', '_')}`, { ...base, name: d.name ?? base.actor }];
    default:
      return ['activity.unknown', base];
  }
}

/**
 * One line of the activity log.
 * `onOpenTask` makes the task key clickable (omit it inside the task itself).
 */
export default function ActivityItem({ activity, onOpenTask, compact }) {
  const { t } = useTranslation();
  const { map: statusMap } = useStatuses();
  const [key, values] = describe(activity, t, statusMap);
  const deleted = activity.type === 'task.deleted';

  const TaskKey = ({ children }) =>
    onOpenTask && activity.task && !deleted ? (
      <button type="button" onClick={() => onOpenTask(activity.task)} className="rounded bg-surface-2 px-1 font-mono text-[12px] font-semibold text-brand hover:underline" title={activity.taskTitle}>
        {children}
      </button>
    ) : (
      <span className="rounded bg-surface-2 px-1 font-mono text-[12px] font-semibold text-muted" title={activity.taskTitle}>
        {children}
      </span>
    );

  return (
    <div className="flex gap-3">
      <Avatar user={activity.actor ?? { name: activity.actorName ?? '?', avatarColor: '#a1a3b8' }} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className={compact ? 'text-[13px] leading-snug' : 'text-sm leading-snug'}>
          <Trans i18nKey={key} values={values} components={{ b: <b className="font-semibold" />, task: <TaskKey />, q: <span className="font-medium" /> }} />
        </p>
        {!compact && activity.taskTitle && !['member', 'sprint'].includes(activity.type.split('.')[0]) && (
          <p className="truncate text-xs text-muted">{activity.taskTitle}</p>
        )}
        {activity.type === 'task.commented' && activity.data?.excerpt && (
          <p className="mt-1 line-clamp-2 rounded-lg bg-surface-2/70 px-2.5 py-1.5 text-xs text-muted">{activity.data.excerpt}</p>
        )}
        <Tooltip label={formatDateTime(activity.createdAt)}>
          <span className="mt-0.5 inline-block text-[11px] text-muted">{relativeTime(activity.createdAt)}</span>
        </Tooltip>
      </div>
    </div>
  );
}
