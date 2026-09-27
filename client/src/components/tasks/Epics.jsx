import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Link2, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { taskKey } from '../../lib/format';
import { StatusBadge, TypeIcon } from '../ui/Badge';
import { ProgressBar } from '../ui/Feedback';
import { OptionList, Popover } from '../ui/Popover';
import Tooltip from '../ui/Tooltip';

const EPIC_COLOR = '#a25ddc';

/** Epics of the current project and their stories. */
export function useEpics() {
  const { tasks } = useProject();
  return useMemo(() => {
    const epics = tasks.filter((t) => t.type === 'epic');
    const byId = Object.fromEntries(epics.map((e) => [e._id, e]));
    const storiesOf = (epicId) => tasks.filter((t) => t.epic === epicId);
    return { epics, byId, storiesOf };
  }, [tasks]);
}

/** Small purple chip with the parent epic's title (table rows, board cards). */
export function EpicChip({ epicId, className }) {
  const { byId } = useEpics();
  const epic = epicId ? byId[epicId] : null;
  if (!epic) return null;
  return (
    <Tooltip label={epic.title}>
      <span
        className={clsx('inline-flex max-w-[140px] shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', className)}
        style={{ background: `${EPIC_COLOR}1f`, color: EPIC_COLOR }}
      >
        <Zap className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        <span className="truncate">{epic.title}</span>
      </span>
    </Tooltip>
  );
}

/** Choose the parent epic of a task (forms and task panel). */
export function EpicPicker({ value, onChange, excludeId }) {
  const { t } = useTranslation();
  const { project } = useProject();
  const { epics, byId } = useEpics();
  const current = value ? byId[value] : null;
  const options = [
    { value: null, label: t('epics.none') },
    ...epics
      .filter((e) => e._id !== excludeId)
      .map((e) => ({
        value: e._id,
        render: (
          <span className="flex min-w-0 items-center gap-2">
            <TypeIcon type="epic" className="h-3.5 w-3.5" />
            <span className="shrink-0 font-mono text-[11px] text-muted">{taskKey(project, e)}</span>
            <span className="truncate">{e.title}</span>
          </span>
        ),
      })),
  ];
  return (
    <Popover
      width={260}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={clsx(
            'flex min-h-[36px] w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition',
            open ? 'border-brand ring-2 ring-brand/20' : 'border-transparent hover:border-line hover:bg-surface-2'
          )}
        >
          <span className="min-w-0 flex-1">{current ? <EpicChip epicId={current._id} className="max-w-full" /> : <span className="text-muted">{epics.length ? t('epics.none') : t('epics.noneYet')}</span>}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        </button>
      )}
    >
      {({ close }) => <OptionList options={options} value={value ?? null} onSelect={(v) => v !== (value ?? null) && onChange(v)} close={close} />}
    </Popover>
  );
}

/** Inside an epic's panel: its stories, progress, and linking existing tasks. */
export function EpicStories({ epic }) {
  const { t } = useTranslation();
  const { project, tasks, updateTask } = useProject();
  const { storiesOf } = useEpics();
  // The task panel lives outside the views' outlet: open a story through the URL
  const [, setSearchParams] = useSearchParams();
  const openStory = (id) =>
    setSearchParams((params) => {
      params.set('task', id);
      return params;
    });
  const stories = storiesOf(epic._id);
  const done = stories.filter((s) => s.completedAt);
  const points = stories.reduce((sum, s) => sum + (s.points || 0), 0);
  const donePoints = done.reduce((sum, s) => sum + (s.points || 0), 0);
  const candidates = tasks.filter((x) => x.type !== 'epic' && !x.epic);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> {t('epics.stories')}
        </h3>
        <span className="text-xs font-semibold text-muted">
          {t('epics.progress', { done: done.length, total: stories.length, points: donePoints, totalPoints: points })}
        </span>
      </div>
      <ProgressBar value={stories.length ? (done.length / stories.length) * 100 : 0} color={EPIC_COLOR} className="mb-2" />
      {stories.length === 0 && <p className="py-2 text-sm text-muted">{t('epics.empty')}</p>}
      <ul className="-mx-2">
        {stories.map((story) => (
          <li key={story._id} className="group/story flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <TypeIcon type={story.type} className="h-3.5 w-3.5" />
            <button type="button" onClick={() => openStory(story._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="shrink-0 font-mono text-[11px] text-muted">{taskKey(project, story)}</span>
              <span className={clsx('truncate text-sm', story.completedAt && 'text-muted line-through')}>{story.title}</span>
            </button>
            <StatusBadge status={story.status} />
            <Tooltip label={t('epics.unlink')}>
              <button type="button" onClick={() => updateTask(story._id, { epic: null })} className="text-muted opacity-0 transition hover:text-[#e2445c] group-hover/story:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
      {candidates.length > 0 && (
        <Popover
          width={280}
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" onClick={toggle} className="btn-ghost mt-1 px-2 text-sm">
              <Link2 className="h-4 w-4" /> {t('epics.link')}
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              options={candidates.slice(0, 40).map((c) => ({
                value: c._id,
                render: (
                  <span className="flex min-w-0 items-center gap-2">
                    <TypeIcon type={c.type} className="h-3.5 w-3.5" />
                    <span className="shrink-0 font-mono text-[11px] text-muted">{taskKey(project, c)}</span>
                    <span className="truncate">{c.title}</span>
                  </span>
                ),
              }))}
              value={null}
              onSelect={(id) => updateTask(id, { epic: epic._id })}
              close={close}
            />
          )}
        </Popover>
      )}
    </section>
  );
}
