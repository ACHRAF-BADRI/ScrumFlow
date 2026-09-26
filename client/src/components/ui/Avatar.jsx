import clsx from 'clsx';
import { UserRound } from 'lucide-react';
import { initials } from '../../lib/format';
import Tooltip from './Tooltip';

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ user, size = 'sm', className, ring, ...rest }) {
  const classes = clsx(
    'inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold',
    SIZES[size],
    ring && 'ring-2 ring-surface',
    className
  );
  if (!user) {
    return (
      <span className={clsx(classes, 'border border-dashed border-line text-muted')} {...rest}>
        <UserRound className="h-3/5 w-3/5" />
      </span>
    );
  }
  return (
    <span className={clsx(classes, 'text-white')} style={{ background: user.avatarColor || '#6161ff' }} {...rest}>
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => (
        <Tooltip key={u._id} label={u.name}>
          <Avatar user={u} size={size} ring />
        </Tooltip>
      ))}
      {extra > 0 && (
        <span className={clsx('inline-flex items-center justify-center rounded-full bg-surface-2 font-bold text-muted ring-2 ring-surface', SIZES[size])}>
          +{extra}
        </span>
      )}
    </div>
  );
}
