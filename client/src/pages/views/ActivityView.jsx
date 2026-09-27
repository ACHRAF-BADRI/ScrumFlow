import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import ActivityItem from '../../components/activity/ActivityItem';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState, Skeleton, Spinner } from '../../components/ui/Feedback';
import { OptionList, Popover } from '../../components/ui/Popover';

const dayKey = (date) => new Date(date).toDateString();

function dayLabel(date, t) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return t('activity.today');
  if (d.toDateString() === yesterday.toDateString()) return t('activity.yesterday');
  return formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ActivityView() {
  const { t } = useTranslation();
  const { openTask } = useOutletContext();
  const { loadActivity, members, tasks, sprints, project } = useProject();
  const [items, setItems] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actor, setActor] = useState(null);
  const timer = useRef(null);

  const loadFirst = useCallback(() => {
    loadActivity({ actor: actor ?? undefined })
      .then((data) => {
        setItems(data.activity);
        setHasMore(data.hasMore);
      })
      .catch(toastError);
  }, [loadActivity, actor]);

  useEffect(() => {
    setItems(null);
    loadFirst();
  }, [loadFirst]);

  // Any change to the project (ours or a teammate's, live) brings a new entry: refresh the top
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(loadFirst, 500);
    return () => clearTimeout(timer.current);
  }, [tasks, sprints, project, loadFirst]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await loadActivity({ before: items[items.length - 1].createdAt, actor: actor ?? undefined });
      setItems((list) => [...list, ...data.activity]);
      setHasMore(data.hasMore);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const out = [];
    for (const item of items ?? []) {
      const key = dayKey(item.createdAt);
      if (out.at(-1)?.key !== key) out.push({ key, date: item.createdAt, items: [] });
      out.at(-1).items.push(item);
    }
    return out;
  }, [items]);

  const selected = members.find((m) => m._id === actor);
  const options = [
    { value: null, label: t('filters.all') },
    ...members.map((m) => ({ value: m._id, render: <span className="flex items-center gap-2"><Avatar user={m} size="xs" />{m.name}</span> })),
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('activity.title')}</h2>
          <p className="text-sm text-muted">{t('activity.subtitle')}</p>
        </div>
        <Popover
          align="end"
          width={220}
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" onClick={toggle} className="btn-secondary h-9">
              {selected ? <Avatar user={selected} size="xs" /> : null}
              {selected?.name ?? t('filters.all')}
            </button>
          )}
        >
          {({ close }) => <OptionList options={options} value={actor} onSelect={setActor} close={close} />}
        </Popover>
      </div>

      {items === null ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState illustration="history" title={t('activity.empty')} text={t('activity.emptyText')} />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{dayLabel(group.date, t)}</h3>
              <ol className="card divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item._id} className="px-4 py-3 sm:px-5">
                    <ActivityItem activity={item} onOpenTask={openTask} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {hasMore && (
            <div className="text-center">
              <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Spinner className="h-4 w-4" />}
                {t('activity.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
