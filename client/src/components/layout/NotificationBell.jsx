import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useRealtime, useRealtimeEvent } from '../../context/RealtimeContext';
import { api } from '../../lib/api';
import { relativeTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Popover } from '../ui/Popover';
import Tooltip from '../ui/Tooltip';

const linkOf = (n) => (n.task ? `/projects/${n.project}?task=${n.task}` : `/projects/${n.project}`);

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connected } = useRealtime();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(
    () =>
      api
        .get('/notifications')
        .then(({ data }) => {
          setItems(data.notifications);
          setUnread(data.unread);
        })
        .catch(() => {}),
    []
  );

  // Initial load, and catch up after a reconnect
  useEffect(() => {
    load();
  }, [load, connected]);

  const describe = useCallback(
    (n) => t(`notifications.${n.type}`, { actor: n.actor?.name ?? t('notifications.someone'), key: n.taskKey, project: n.projectName }),
    [t]
  );

  const open = useCallback(
    (n) => {
      if (!n.read) {
        setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
        api.patch(`/notifications/${n._id}/read`).catch(() => {});
      }
      navigate(linkOf(n));
    },
    [navigate]
  );

  useRealtimeEvent('notification', ({ notification }) => {
    setItems((list) => [notification, ...list.filter((x) => x._id !== notification._id)].slice(0, 30));
    setUnread((u) => u + 1);
    // Resync with the server (an initial load still in flight could have overwritten this)
    setTimeout(load, 400);
    toast(describe(notification), {
      description: notification.taskTitle,
      icon: <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />,
      action: { label: t('notifications.open'), onClick: () => open(notification) },
    });
  });

  const markAll = () => {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.post('/notifications/read-all').catch(() => {});
  };

  return (
    <Popover
      align="end"
      width={360}
      trigger={({ toggle, ref }) => (
        <Tooltip label={t('notifications.title')} side="bottom">
          <button ref={ref} type="button" onClick={toggle} className="btn-icon relative" aria-label={t('notifications.title')} data-tour="bell">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e2445c] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <div className="-m-1.5">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-bold">{t('notifications.title')}</h3>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> {t('notifications.markAll')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <BellOff className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold">{t('notifications.empty')}</p>
              <p className="mt-1 text-xs text-muted">{t('notifications.emptyText')}</p>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              {items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      open(n);
                    }}
                    className={clsx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2', !n.read && 'bg-brand/[0.05]')}
                  >
                    <Avatar user={n.actor} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug">{describe(n)}</span>
                      {(n.excerpt || n.taskTitle) && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.excerpt || n.taskTitle}</span>}
                      <span className="mt-1 block text-[11px] text-muted">{relativeTime(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label={t('notifications.unread')} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
