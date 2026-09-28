import { useEffect, useState } from 'react';
import { Copy, GitBranch, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';
import { api, toastError } from '../lib/api';
import { useConfirm } from './ui/Confirm';
import Tooltip from './ui/Tooltip';

function CopyField({ label, value, testId }) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="flex gap-1.5">
        <input className="input h-9 font-mono text-xs" readOnly value={value} onFocus={(e) => e.target.select()} data-testid={testId} />
        <Tooltip label={t('share.copy')}>
          <button
            type="button"
            className="btn-secondary h-9 px-2.5"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              toast.success(t('share.copied'));
            }}
            aria-label={t('share.copy')}
          >
            <Copy className="h-4 w-4" />
          </button>
        </Tooltip>
      </span>
    </label>
  );
}

/** GitHub webhook of the project (managers): URL + secret to paste in the repository settings. */
export default function GitHubCard() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { project } = useProject();
  const [state, setState] = useState(null);
  const base = `/projects/${project._id}/github`;

  useEffect(() => {
    api
      .get(base)
      .then(({ data }) => setState(data))
      .catch(() => {});
  }, [base]);

  const run = (request) =>
    request()
      .then(({ data }) => setState(data))
      .catch(toastError);

  const disconnect = async () => {
    const ok = await confirm({ title: t('github.disconnect'), message: t('github.disconnectConfirm'), danger: true, confirmLabel: t('github.disconnect') });
    if (ok) run(() => api.delete(base));
  };

  if (!state) return null;
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <GitBranch className="h-4 w-4 text-brand" /> {t('github.title')}
        {state.connected && state.repo && <span className="truncate font-mono text-xs font-normal text-muted">{state.repo}</span>}
      </h3>
      <p className="mt-1 text-xs text-muted">
        <Trans i18nKey="github.text" values={{ key: project.key }} components={{ code: <code className="rounded bg-surface-2 px-1 font-mono" /> }} />
      </p>
      {!state.connected ? (
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => run(() => api.post(base))}>
          {t('github.connect')}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
            <li>{t('github.step1')}</li>
            <li>{t('github.step2')}</li>
            <li>{t('github.step3')}</li>
          </ol>
          <CopyField label={t('github.payloadUrl')} value={state.webhookUrl} testId="github-url" />
          <CopyField label={t('github.secret')} value={state.secret} testId="github-secret" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.autoClose} onChange={(e) => run(() => api.patch(base, { autoClose: e.target.checked }))} className="accent-[#6161ff]" />
            {t('github.autoClose')}
          </label>
          <button type="button" className="btn-ghost h-8 px-2 text-xs text-[#e2445c]" onClick={disconnect}>
            <Unplug className="h-3.5 w-3.5" /> {t('github.disconnect')}
          </button>
        </div>
      )}
    </section>
  );
}
