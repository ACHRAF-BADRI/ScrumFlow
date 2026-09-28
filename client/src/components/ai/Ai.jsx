import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Plus, RotateCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { api, errorMessage } from '../../lib/api';
import { useServerConfig } from '../../lib/serverConfig';
import { Markdown } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { Popover } from '../ui/Popover';
import { Skeleton } from '../ui/Feedback';

/** The AI provider name when AI is set up on the server, else null. */
export function useAi() {
  return useServerConfig().ai?.provider ?? null;
}

/** Runs an AI request with loading and error state. */
function useAiRequest(path) {
  const { project } = useProject();
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const { data } = await api.post(`/projects/${project._id}/ai/${path}`);
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({ loading: false, data: null, error: errorMessage(err) });
    }
  };
  return [state, run];
}

function Footnote({ provider, usage }) {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] leading-snug text-muted">
      {t('ai.footnote', { provider })}
      {usage && ` ${t('ai.usage', { used: usage.used, limit: usage.limit })}`}
    </p>
  );
}

function Loading() {
  return (
    <div className="space-y-2" data-testid="ai-loading">
      {['w-4/5', 'w-2/3', 'w-11/12', 'w-1/2'].map((w) => (
        <Skeleton key={w} className={`h-5 ${w}`} />
      ))}
    </div>
  );
}

export function AiButton({ onClick, children, className, testId }) {
  return (
    <button type="button" onClick={onClick} className={clsx('btn-ghost h-7 px-2 text-xs text-[#a25ddc] hover:bg-[#a25ddc]/10', className)} data-testid={testId}>
      <Sparkles className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function Pick({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
      <input type="checkbox" className="mt-0.5 accent-[#a25ddc]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Task drawer: suggested checklist steps and acceptance criteria. */
export function AiBreakdown({ task }) {
  const { t } = useTranslation();
  const provider = useAi();
  const { addChecklistItem, updateTask } = useProject();
  const [open, setOpen] = useState(false);
  const [{ loading, data, error }, run] = useAiRequest(`tasks/${task._id}/breakdown`);
  const [picked, setPicked] = useState({});
  const [saving, setSaving] = useState(false);
  if (!provider) return null;

  const start = async () => {
    setOpen(true);
    setPicked({});
    await run();
  };
  const isPicked = (id) => picked[id] !== false; // everything selected by default

  const apply = async () => {
    setSaving(true);
    try {
      const steps = data.checklist.filter((_, i) => isPicked(`c${i}`));
      const criteria = data.acceptanceCriteria.filter((_, i) => isPicked(`a${i}`));
      for (const step of steps) await addChecklistItem(task._id, step);
      if (criteria.length) {
        const block = `**${t('ai.criteriaHeading')}**\n${criteria.map((c) => `- [ ] ${c}`).join('\n')}`;
        await updateTask(task._id, { description: [task.description?.trim(), block].filter(Boolean).join('\n\n') });
      }
      toast.success(t('ai.added', { count: steps.length + criteria.length }));
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const count = data ? [...data.checklist.map((_, i) => `c${i}`), ...data.acceptanceCriteria.map((_, i) => `a${i}`)].filter(isPicked).length : 0;

  return (
    <>
      <AiButton onClick={start} testId="ai-breakdown">
        {t('ai.breakdown')}
      </AiButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('ai.breakdownTitle')}
        footer={
          <>
            <button type="button" className="btn-ghost mr-auto" onClick={run} disabled={loading}>
              <RotateCw className="h-4 w-4" /> {t('ai.again')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={apply} disabled={!data || !count || saving} data-testid="ai-apply">
              {t('ai.addSelected', { count })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="truncate text-sm font-semibold">{task.title}</p>
          {loading && <Loading />}
          {error && <p className="rounded-lg bg-[#e2445c]/10 px-3 py-2 text-sm text-[#e2445c]">{error}</p>}
          {data && (
            <>
              <section>
                <h3 className="label">{t('ai.steps')}</h3>
                {data.checklist.map((step, i) => (
                  <Pick key={`c${i}`} checked={isPicked(`c${i}`)} onChange={(v) => setPicked((p) => ({ ...p, [`c${i}`]: v }))}>
                    {step}
                  </Pick>
                ))}
              </section>
              {data.acceptanceCriteria.length > 0 && (
                <section>
                  <h3 className="label">{t('ai.criteria')}</h3>
                  {data.acceptanceCriteria.map((c, i) => (
                    <Pick key={`a${i}`} checked={isPicked(`a${i}`)} onChange={(v) => setPicked((p) => ({ ...p, [`a${i}`]: v }))}>
                      {c}
                    </Pick>
                  ))}
                  <p className="mt-1 px-2 text-[11px] text-muted">{t('ai.criteriaHint')}</p>
                </section>
              )}
            </>
          )}
          <Footnote provider={provider} usage={data?.usage} />
        </div>
      </Modal>
    </>
  );
}

/** Next to the points of a task: a suggested estimate with its reason. */
export function AiEstimate({ task }) {
  const { t } = useTranslation();
  const provider = useAi();
  const { updateTask, tasks, project } = useProject();
  const [, setSearchParams] = useSearchParams();
  const [{ loading, data, error }, run] = useAiRequest(`tasks/${task._id}/estimate`);
  if (!provider) return null;
  const byKey = Object.fromEntries(tasks.map((x) => [`${project.key}-${x.number}`, x]));

  return (
    <Popover
      width={300}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          className="btn-icon h-8 w-8 shrink-0 text-[#a25ddc] hover:bg-[#a25ddc]/10"
          onClick={(e) => {
            toggle(e);
            if (!data && !loading) run();
          }}
          aria-label={t('ai.estimate')}
          title={t('ai.estimate')}
          data-testid="ai-estimate"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="space-y-3 p-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#a25ddc]">{t('ai.estimate')}</p>
          {loading && <Loading />}
          {error && <p className="text-sm text-[#e2445c]">{error}</p>}
          {data && (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{data.points ?? '?'}</span>
                <span className="text-sm text-muted">{t('common.points')}</span>
              </p>
              {data.reason && <p className="text-sm">{data.reason}</p>}
              {data.similar.length > 0 && (
                <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
                  {t('ai.similar')}
                  {data.similar.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand hover:underline"
                      title={byKey[key]?.title}
                      onClick={() => {
                        if (!byKey[key]) return;
                        close();
                        setSearchParams((params) => {
                          params.set('task', byKey[key]._id);
                          return params;
                        });
                      }}
                    >
                      {key} · {byKey[key]?.points ?? '?'}
                    </button>
                  ))}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary h-8 flex-1"
                  disabled={data.points === null || data.points === task.points}
                  onClick={() => {
                    updateTask(task._id, { points: data.points });
                    close();
                  }}
                  data-testid="ai-estimate-apply"
                >
                  <Check className="h-4 w-4" /> {t('ai.use', { points: data.points })}
                </button>
                <button type="button" className="btn-secondary h-8 px-2.5" onClick={run} disabled={loading} aria-label={t('ai.again')}>
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          <Footnote provider={provider} usage={data?.usage} />
        </div>
      )}
    </Popover>
  );
}

/** Retrospective: a written sprint review and suggested cards to add. */
export function AiRetroDraft({ sprint, onAdd }) {
  const { t } = useTranslation();
  const provider = useAi();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState({});
  const [{ loading, data, error }, run] = useAiRequest(`sprints/${sprint._id}/summary`);
  if (!provider) return null;

  const start = async () => {
    setOpen(true);
    setAdded({});
    await run();
  };
  const add = async (column, text, id) => {
    setAdded((a) => ({ ...a, [id]: true }));
    await onAdd(column, text);
  };
  const columns = data
    ? [
        ['wentWell', data.wentWell],
        ['toImprove', data.toImprove],
        ['actions', data.actions],
      ]
    : [];
  const all = columns.flatMap(([column, items]) => items.map((text, i) => ({ column, text, id: `${column}${i}` })));

  return (
    <>
      <AiButton onClick={start} className="h-9 px-3 text-sm" testId="ai-retro">
        {t('ai.retro')}
      </AiButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={t('ai.retroTitle', { name: sprint.name })}
        footer={
          <>
            <button type="button" className="btn-ghost mr-auto" onClick={run} disabled={loading}>
              <RotateCw className="h-4 w-4" /> {t('ai.again')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!data || all.every((c) => added[c.id])}
              onClick={async () => {
                for (const card of all.filter((c) => !added[c.id])) await add(card.column, card.text, card.id);
              }}
            >
              <Plus className="h-4 w-4" /> {t('ai.addAll')}
            </button>
            <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {loading && <Loading />}
          {error && <p className="rounded-lg bg-[#e2445c]/10 px-3 py-2 text-sm text-[#e2445c]">{error}</p>}
          {data && (
            <>
              {data.summary && (
                <section className="rounded-xl bg-[#a25ddc]/5 p-3.5" data-testid="ai-summary">
                  <Markdown text={data.summary} className="text-sm" />
                </section>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {columns.map(([column, items]) => (
                  <section key={column}>
                    <h3 className="label">{t(`retro.${column}`)}</h3>
                    <ul className="space-y-1.5">
                      {items.map((text, i) => {
                        const id = `${column}${i}`;
                        return (
                          <li key={id} className="flex items-start gap-2 rounded-lg border border-line p-2 text-sm">
                            <span className="min-w-0 flex-1">{text}</span>
                            <button
                              type="button"
                              className={clsx('btn-icon h-6 w-6 shrink-0', added[id] && 'text-[#00c875]')}
                              disabled={added[id]}
                              onClick={() => add(column, text, id)}
                              aria-label={t('ai.addCard')}
                            >
                              {added[id] ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
          <Footnote provider={provider} usage={data?.usage} />
        </div>
      </Modal>
    </>
  );
}
