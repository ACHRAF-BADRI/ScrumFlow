import clsx from 'clsx';
import { Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';

export default function SprintGoal({ goal, className }) {
  const { t } = useTranslation();
  if (!goal) return null;
  return (
    <p className={clsx('flex min-w-0 items-center gap-2 text-sm text-muted', className)}>
      <Tooltip label={t('sprint.goal')}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
          <Target className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      </Tooltip>
      <span className="truncate">{goal}</span>
    </p>
  );
}
