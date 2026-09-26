import clsx from 'clsx';
import Illustration from './Illustration';

export function Spinner({ className }) {
  return <span className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ icon: Icon, illustration, title, text, action, className, compact }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-6' : 'py-14', className)}>
      {illustration ? (
        <Illustration name={illustration} className={clsx('mb-2', compact ? 'max-w-[150px]' : 'max-w-[240px]')} />
      ) : (
        Icon && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Icon className="h-7 w-7" />
          </div>
        )
      )}
      <h3 className={clsx('font-bold', compact ? 'text-sm' : 'text-lg')}>{title}</h3>
      {text && <p className={clsx('mt-1 max-w-sm text-muted', compact ? 'text-xs' : 'text-sm')}>{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-lg bg-surface-2', className)} />;
}

export function ProgressBar({ value, color = '#00c875', className }) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}
