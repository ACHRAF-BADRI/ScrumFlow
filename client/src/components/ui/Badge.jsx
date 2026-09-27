import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { PRIORITY_MAP, TYPE_MAP } from '../../lib/constants';
import { useStatuses } from '../../hooks/useStatuses';

export function Badge({ color = '#6161ff', icon: Icon, dot, className, children }) {
  return (
    <span className={clsx('badge', className)} style={{ '--c': color }}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** `statuses`: the task's project workflow when outside a project page (e.g. My work). */
export function StatusBadge({ status, className, statuses }) {
  const { map } = useStatuses(statuses);
  const meta = map[status];
  return (
    <Badge color={meta?.color ?? '#a1a3b8'} dot className={className}>
      {meta?.name ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }) {
  const { t } = useTranslation();
  const meta = PRIORITY_MAP[priority];
  return (
    <Badge color={meta?.color} className={className}>
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className="w-[3px] rounded-sm"
            style={{
              height: 4 + bar * 2,
              background: 'currentColor',
              opacity: bar <= ({ low: 1, medium: 2, high: 3, critical: 3 }[priority] ?? 1) ? 1 : 0.25,
            }}
          />
        ))}
      </span>
      <span className="ml-0.5">{t(`priority.${priority}`)}</span>
    </Badge>
  );
}

export function TypeIcon({ type, className = 'h-4 w-4' }) {
  const meta = TYPE_MAP[type] ?? TYPE_MAP.task;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md p-0.5"
      style={{ background: `${meta.color}22`, color: meta.color }}
    >
      <Icon className={className} strokeWidth={2.4} />
    </span>
  );
}

export function TypeBadge({ type }) {
  const { t } = useTranslation();
  const meta = TYPE_MAP[type] ?? TYPE_MAP.task;
  return (
    <Badge color={meta.color} icon={meta.icon}>
      {t(`type.${type}`)}
    </Badge>
  );
}

const ROLE_COLORS = { owner: '#ff642e', admin: '#6161ff', member: '#a1a3b8' };
export function RoleBadge({ role }) {
  const { t } = useTranslation();
  return <Badge color={ROLE_COLORS[role]}>{t(`role.${role}`)}</Badge>;
}

const SPRINT_COLORS = { active: '#00c875', planned: '#579bfc', completed: '#a1a3b8' };
export function SprintStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge color={SPRINT_COLORS[status]} dot={status === 'active'}>
      {t(`sprint.${status}`)}
    </Badge>
  );
}

export function LabelChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
      #{children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-ink" aria-label="remove">
          ×
        </button>
      )}
    </span>
  );
}
