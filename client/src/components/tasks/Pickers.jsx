import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PRIORITIES, PRIORITY_MAP, STATUSES, STATUS_MAP, STORY_POINTS, TYPES } from '../../lib/constants';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge, StatusBadge, TypeBadge, TypeIcon } from '../ui/Badge';
import { OptionList, Popover } from '../ui/Popover';
import Tooltip from '../ui/Tooltip';
import { useProject } from '../../context/ProjectContext';

function ColorSwatchOption({ color, children }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="h-3.5 w-3.5 rounded" style={{ background: color }} />
      {children}
    </span>
  );
}

/** Field button used in forms / the task drawer. */
function FieldButton({ open, toggle, innerRef, children, disabled }) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={clsx(
        'flex min-h-[36px] w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition',
        open ? 'border-brand ring-2 ring-brand/20' : 'border-transparent hover:border-line hover:bg-surface-2',
        disabled && 'pointer-events-none'
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {!disabled && <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
    </button>
  );
}

/**
 * variant "cell": full-height solid color block (table view)
 * variant "field": labelled button (drawer / forms)
 * variant "badge": compact pill (cards)
 */
export function StatusPicker({ value, onChange, variant = 'field', disabled }) {
  const { t } = useTranslation();
  const color = STATUS_MAP[value]?.color;
  return (
    <Popover
      width={200}
      trigger={({ open, toggle, ref }) =>
        variant === 'cell' ? (
          <button ref={ref} type="button" onClick={toggle} className="cell-solid" style={{ '--c': color }} disabled={disabled}>
            {t(`status.${value}`)}
          </button>
        ) : variant === 'badge' ? (
          <button ref={ref} type="button" onClick={toggle} disabled={disabled}>
            <StatusBadge status={value} />
          </button>
        ) : (
          <FieldButton open={open} toggle={toggle} innerRef={ref} disabled={disabled}>
            <StatusBadge status={value} />
          </FieldButton>
        )
      }
    >
      {({ close }) => (
        <div className="grid gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={clsx('rounded-md px-3 py-2 text-center text-[13px] font-semibold text-white transition hover:brightness-95', value === s.id && 'ring-2 ring-offset-2 ring-offset-surface')}
              style={{ background: s.color, '--tw-ring-color': s.color }}
              onClick={() => {
                if (s.id !== value) onChange(s.id);
                close();
              }}
            >
              {t(`status.${s.id}`)}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function PriorityPicker({ value, onChange, variant = 'field', disabled }) {
  const { t } = useTranslation();
  const options = PRIORITIES.map((p) => ({
    value: p.id,
    render: <ColorSwatchOption color={p.color}>{t(`priority.${p.id}`)}</ColorSwatchOption>,
  }));
  return (
    <Popover
      width={180}
      trigger={({ open, toggle, ref }) =>
        variant === 'cell' ? (
          <button ref={ref} type="button" onClick={toggle} className="cell-solid" style={{ '--c': PRIORITY_MAP[value]?.color }} disabled={disabled}>
            {t(`priority.${value}`)}
          </button>
        ) : (
          <FieldButton open={open} toggle={toggle} innerRef={ref} disabled={disabled}>
            <PriorityBadge priority={value} />
          </FieldButton>
        )
      }
    >
      {({ close }) => <OptionList options={options} value={value} onSelect={(v) => v !== value && onChange(v)} close={close} />}
    </Popover>
  );
}

export function TypePicker({ value, onChange, variant = 'field' }) {
  const { t } = useTranslation();
  const options = TYPES.map((type) => ({
    value: type.id,
    render: (
      <span className="flex items-center gap-2">
        <TypeIcon type={type.id} className="h-3.5 w-3.5" />
        {t(`type.${type.id}`)}
      </span>
    ),
  }));
  return (
    <Popover
      width={170}
      trigger={({ open, toggle, ref }) =>
        variant === 'icon' ? (
          <Tooltip label={t(`type.${value}`)}>
            <button ref={ref} type="button" onClick={toggle}>
              <TypeIcon type={value} className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : (
          <FieldButton open={open} toggle={toggle} innerRef={ref}>
            <TypeBadge type={value} />
          </FieldButton>
        )
      }
    >
      {({ close }) => <OptionList options={options} value={value} onSelect={(v) => v !== value && onChange(v)} close={close} />}
    </Popover>
  );
}

export function AssigneePicker({ value, onChange, variant = 'field' }) {
  const { t } = useTranslation();
  const { members, memberById } = useProject();
  const current = value ? memberById[value] ?? null : null;
  const options = [
    {
      value: null,
      render: (
        <span className="flex items-center gap-2 text-muted">
          <Avatar user={null} size="sm" />
          {t('common.unassigned')}
        </span>
      ),
    },
    ...members.map((m) => ({
      value: m._id,
      render: (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar user={m} size="sm" />
          <span className="truncate">{m.name}</span>
        </span>
      ),
    })),
  ];

  return (
    <Popover
      width={220}
      trigger={({ open, toggle, ref }) =>
        variant === 'cell' ? (
          <Tooltip label={current?.name ?? t('common.unassigned')}>
            <button ref={ref} type="button" onClick={toggle} className="flex h-full w-full items-center justify-center hover:bg-surface-2">
              <Avatar user={current} size="sm" />
            </button>
          </Tooltip>
        ) : variant === 'avatar' ? (
          <Tooltip label={current?.name ?? t('common.unassigned')}>
            <button ref={ref} type="button" onClick={toggle} className="rounded-full">
              <Avatar user={current} size="sm" />
            </button>
          </Tooltip>
        ) : (
          <FieldButton open={open} toggle={toggle} innerRef={ref}>
            <span className="flex items-center gap-2">
              <Avatar user={current} size="sm" />
              <span className={clsx('truncate', !current && 'text-muted')}>{current?.name ?? t('common.unassigned')}</span>
            </span>
          </FieldButton>
        )
      }
    >
      {({ close }) => <OptionList options={options} value={value ?? null} onSelect={(v) => v !== (value ?? null) && onChange(v)} close={close} />}
    </Popover>
  );
}

export function PointsPicker({ value, onChange, variant = 'field' }) {
  const { t } = useTranslation();
  return (
    <Popover
      width={184}
      trigger={({ open, toggle, ref }) =>
        variant === 'cell' ? (
          <button ref={ref} type="button" onClick={toggle} className="flex h-full w-full items-center justify-center text-sm font-semibold hover:bg-surface-2">
            {value ? value : <span className="text-muted/60">–</span>}
          </button>
        ) : (
          <FieldButton open={open} toggle={toggle} innerRef={ref}>
            <span className="font-semibold">{value ?? 0}</span> <span className="text-muted">{t('common.points')}</span>
          </FieldButton>
        )
      }
    >
      {({ close }) => (
        <div className="grid grid-cols-4 gap-1">
          {STORY_POINTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (p !== value) onChange(p);
                close();
              }}
              className={clsx('h-9 rounded-lg text-sm font-bold transition', p === value ? 'bg-brand text-white' : 'bg-surface-2 hover:bg-brand/15 hover:text-brand')}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function SprintPicker({ value, onChange }) {
  const { t } = useTranslation();
  const { sprints } = useProject();
  const open = sprints.filter((s) => s.status !== 'completed' || s._id === value);
  const current = sprints.find((s) => s._id === value);
  const options = [
    { value: null, label: t('common.backlog') },
    ...open.map((s) => ({
      value: s._id,
      render: (
        <span className="flex items-center gap-2">
          {s.name}
          {s.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-[#00c875]" />}
        </span>
      ),
    })),
  ];

  return (
    <Popover
      width={220}
      trigger={({ open: isOpen, toggle, ref }) => (
        <FieldButton open={isOpen} toggle={toggle} innerRef={ref}>
          <span className="truncate">{current?.name ?? t('common.backlog')}</span>
        </FieldButton>
      )}
    >
      {({ close }) => <OptionList options={options} value={value ?? null} onSelect={(v) => v !== (value ?? null) && onChange(v)} close={close} />}
    </Popover>
  );
}
