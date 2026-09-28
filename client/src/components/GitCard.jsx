import { useEffect, useState } from 'react';
import { Copy, GitBranch, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';
import { api, toastError } from '../lib/api';
import { GitHubMark, GitLabMark } from './auth/SignIn';
import { useConfirm } from './ui/Confirm';
import Tooltip from './ui/Tooltip';

const PROVIDERS = { github: { name: 'GitHub', Mark: GitHubMark }, gitlab: { name: 'GitLab', Mark: GitLabMark } };

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

/** GitHub or GitLab webhook of the project (managers): URL + secret to paste in the repository settings. */
export default function GitCard() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { project } = useProject();
  const [state, setState] = useState(null);
  const base = `/projects/${project._id}/git`;

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
    const ok = await confirm({ title: t('git.disconnect'), message: t('git.disconnectConfirm', { name: PROVIDERS[state.provider].name }), danger: true, confirmLabel: t('git.disconnect') });
    if (ok) run(() => api.delete(base));
  };

  if (!state) return null;
  const { name, Mark } = PROVIDERS[state.provider] ?? PROVIDERS.github;

  return (
    <section className="card p-4 sm:p-5" data-testid="git-card">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <GitBranch className="h-4 w-4 text-brand" /> {t('git.title')}
        {state.connected && (
          <span className="flex min-w-0 items-center gap-1.5 font-normal text-muted">
            <Mark /> <span className="truncate font-mono text-xs">{state.repo || name}</span>
          </span>
        )}
      </h3>
      <p className="mt-1 text-xs text-muted">
        <Trans i18nKey="git.text" values={{ key: project.key }} components={{ code: <code className="rounded bg-surface-2 px-1 font-mono" /> }} />
      </p>
      {!state.connected ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(PROVIDERS).map(([id, p]) => (
            <button key={id} type="button" className="btn-secondary h-10 justify-center" onClick={() => run(() => api.post(base, { provider: id }))} data-testid={`connect-${id}`}>
              <p.Mark /> {t('git.connect', { name: p.name })}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
            <li>{t(`git.${state.provider}.step1`)}</li>
            <li>{t(`git.${state.provider}.step2`)}</li>
            <li>{t(`git.${state.provider}.step3`)}</li>
          </ol>
          <CopyField label={t(`git.${state.provider}.url`)} value={state.webhookUrl} testId="git-url" />
          <CopyField label={t(`git.${state.provider}.secret`)} value={state.secret} testId="git-secret" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.autoClose} onChange={(e) => run(() => api.patch(base, { autoClose: e.target.checked }))} className="accent-[#6161ff]" />
            {t(`git.${state.provider}.autoClose`)}
          </label>
          <button type="button" className="btn-ghost h-8 px-2 text-xs text-[#e2445c]" onClick={disconnect}>
            <Unplug className="h-3.5 w-3.5" /> {t('git.disconnect')}
          </button>
        </div>
      )}
    </section>
  );
}
