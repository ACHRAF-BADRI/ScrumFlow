import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, Coffee, Eye, RotateCcw, Spade, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { useRealtime, useRealtimeEvent } from '../../context/RealtimeContext';
import { taskKey } from '../../lib/format';
import { Avatar } from '../../components/ui/Avatar';
import { TypeIcon } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';

export const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'];

const CardFace = ({ value, className }) => (value === 'coffee' ? <Coffee className={clsx('h-5 w-5', className)} /> : <span className={className}>{value}</span>);

function TaskList({ round, onStart }) {
  const { t } = useTranslation();
  const { project, tasks, sprints } = useProject();
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const rank = (task) => {
    const sprint = sprints.find((s) => s._id === task.sprint);
    return sprint?.status === 'active' ? 0 : sprint ? 1 : 2;
  };
  const list = useMemo(
    () =>
      tasks
        .filter((x) => !x.completedAt && x.type !== 'epic' && (!onlyEmpty || !x.points))
        .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
        .slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, sprints, onlyEmpty]
  );

  return (
    <aside className="card flex max-h-[70vh] flex-col overflow-hidden lg:sticky lg:top-20">
      <div className="border-b border-line p-3">
        <h3 className="text-sm font-bold">{t('poker.toEstimate')}</h3>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="accent-[var(--brand,#6161ff)]" />
          {t('poker.onlyEmpty')}
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto p-1.5">
        {list.map((task) => (
          <li key={task._id}>
            <button
              type="button"
              onClick={() => onStart(task._id)}
              className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2', round?.taskId === task._id && 'bg-brand/10 text-brand')}
            >
              <TypeIcon type={task.type} className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-muted">{taskKey(project, task)}</span>
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              {task.points > 0 && <span className="rounded bg-surface-2 px-1.5 text-[11px] font-bold text-muted">{task.points}</span>}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">{t('poker.allEstimated')}</li>}
      </ul>
    </aside>
  );
}

export default function PokerView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const { project, tasks, viewers, updateTask } = useProject();
  const [round, setRound] = useState(null);
  const [myVote, setMyVote] = useState(null);

  const joined = viewers.some((v) => v._id === user._id);
  // Ask for the current round once the socket has joined the project room
  useEffect(() => {
    if (!socket || !connected || !joined) return;
    socket.emit('poker:get', null, (res) => res?.ok && setRound(res.state));
  }, [socket, connected, joined]);

  useRealtimeEvent('poker:state', (event) => {
    if (event.projectId !== project._id) return;
    setRound(event.state);
    if (!event.state || !event.state.votes.some((v) => v.user._id === user._id)) setMyVote(null);
  });

  const emit = useCallback((event, payload) => socket?.emit(event, payload ?? {}), [socket]);
  const task = round && tasks.find((x) => x._id === round.taskId);

  const participants = useMemo(() => {
    const map = new Map(viewers.map((v) => [v._id, { user: v, vote: undefined }]));
    for (const v of round?.votes ?? []) map.set(v.user._id, { user: v.user, vote: v.value ?? 'hidden' });
    return [...map.values()];
  }, [viewers, round]);

  const vote = (value) => {
    setMyVote((current) => (current === value ? null : value));
    emit('poker:vote', { value });
  };

  const save = async (points) => {
    const saved = await updateTask(task._id, { points });
    if (!saved) return;
    toast.success(t('poker.saved', { points, key: taskKey(project, task) }));
    emit('poker:end');
  };

  if (!connected) return <EmptyState illustration="error" title={t('poker.offline')} text={t('poker.offlineText')} />;

  const numericVotes = [...new Set((round?.votes ?? []).map((v) => v.value).filter((v) => /^\d+$/.test(v ?? '')))].map(Number).sort((a, b) => a - b);

  return (
    <div className="grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[18rem_1fr]">
      <TaskList round={round} onStart={(taskId) => emit('poker:start', { taskId })} />

      {!round || !task ? (
        <EmptyState icon={Spade} title={t('poker.emptyTitle')} text={t('poker.emptyText')} />
      ) : (
        <section className="space-y-6">
          <div className="card p-4 sm:p-5">
            <div className="mb-1 flex items-center gap-2">
              <TypeIcon type={task.type} className="h-4 w-4" />
              <span className="font-mono text-xs font-semibold text-muted">{taskKey(project, task)}</span>
              {task.points > 0 && <span className="text-xs text-muted">· {t('poker.current', { points: task.points })}</span>}
              <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={() => emit('poker:end')} aria-label={t('poker.end')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-xl font-bold">{task.title}</h2>
            {task.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted">{task.description}</p>}
          </div>

          <div className="flex flex-wrap justify-center gap-4" data-testid="poker-table">
            {participants.map(({ user: person, vote: value }) => (
              <div key={person._id} className="flex w-20 flex-col items-center gap-2">
                <div
                  className={clsx(
                    'flex h-24 w-16 items-center justify-center rounded-xl border-2 text-2xl font-extrabold transition',
                    value === undefined && 'border-dashed border-line text-muted',
                    value === 'hidden' && 'border-brand bg-brand text-white',
                    value && value !== 'hidden' && 'border-brand bg-surface text-brand shadow-pop'
                  )}
                >
                  {value === 'hidden' ? <Check className="h-6 w-6" /> : value ? <CardFace value={value} /> : '…'}
                </div>
                <span className="flex max-w-full items-center gap-1 text-xs font-semibold">
                  <Avatar user={person} size="xs" />
                  <span className="truncate">{person._id === user._id ? t('common.you') : person.name.split(' ')[0]}</span>
                </span>
              </div>
            ))}
          </div>

          {round.revealed ? (
            <div className="card space-y-4 p-4 text-center sm:p-5">
              <div className="flex flex-wrap justify-center gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">{t('poker.average')}</p>
                  <p className="text-3xl font-extrabold">{round.average ?? '?'}</p>
                </div>
                {round.consensus && <p className="self-center rounded-full bg-[#00c875]/15 px-3 py-1 text-sm font-bold text-[#00a862]">{t('poker.consensus')}</p>}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {round.suggestion !== null && round.suggestion !== undefined && (
                  <button type="button" className="btn-primary" onClick={() => save(round.suggestion)}>
                    {t('poker.save', { points: round.suggestion })}
                  </button>
                )}
                {numericVotes
                  .filter((v) => v !== round.suggestion)
                  .map((v) => (
                    <button key={v} type="button" className="btn-secondary" onClick={() => save(v)}>
                      {t('poker.save', { points: v })}
                    </button>
                  ))}
                <button type="button" className="btn-ghost" onClick={() => emit('poker:restart')}>
                  <RotateCcw className="h-4 w-4" /> {t('poker.again')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t('poker.yourCard')}>
                {CARDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => vote(value)}
                    aria-pressed={myVote === value}
                    aria-label={value === 'coffee' ? t('poker.break') : value}
                    className={clsx(
                      'flex h-20 w-14 items-center justify-center rounded-xl border-2 text-xl font-extrabold transition hover:-translate-y-1',
                      myVote === value ? '-translate-y-2 border-brand bg-brand text-white shadow-pop' : 'border-line bg-surface hover:border-brand'
                    )}
                  >
                    <CardFace value={value} />
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                <button type="button" className="btn-primary" disabled={!round.votes.length} onClick={() => emit('poker:reveal')}>
                  <Eye className="h-4 w-4" /> {t('poker.reveal', { count: round.votes.length })}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
