import { useEffect, useState } from 'react';
import { Copy, Globe, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';
import { api, toastError } from '../lib/api';
import { useConfirm } from './ui/Confirm';
import Tooltip from './ui/Tooltip';

/** Public read-only link of the board (managers). */
export default function ShareCard() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { project } = useProject();
  const [token, setToken] = useState(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const base = `/projects/${project._id}/share`;
  const url = token ? `${window.location.origin}/share/${token}` : '';

  useEffect(() => {
    api
      .get(base)
      .then(({ data }) => setToken(data.token))
      .catch(() => setToken(null));
  }, [base]);

  const run = async (request, message) => {
    setBusy(true);
    try {
      const { data } = await request();
      setToken(data.token);
      if (message) toast.success(message);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!token) return run(() => api.post(base), t('share.enabled'));
    const ok = await confirm({ title: t('share.disable'), message: t('share.disableConfirm'), danger: true, confirmLabel: t('share.disable') });
    if (ok) run(() => api.delete(base), t('share.disabled'));
  };
  const regenerate = async () => {
    const ok = await confirm({ title: t('share.regenerate'), message: t('share.regenerateConfirm'), confirmLabel: t('share.regenerate') });
    if (ok) run(() => api.post(base), t('share.regenerated'));
  };
  const copy = () => {
    navigator.clipboard?.writeText(url);
    toast.success(t('share.copied'));
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 text-sm font-bold">
          <Globe className="h-4 w-4 text-brand" /> {t('share.title')}
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(token)}
          aria-label={t('share.title')}
          disabled={busy || token === undefined}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${token ? 'bg-brand' : 'bg-line'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${token ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{t('share.text')}</p>
      {token && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1.5">
            <input className="input h-9 font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t('share.link')} data-testid="share-url" />
            <Tooltip label={t('share.copy')}>
              <button type="button" className="btn-secondary h-9 px-2.5" onClick={copy} aria-label={t('share.copy')}>
                <Copy className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
          <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={regenerate} disabled={busy}>
            <RotateCw className="h-3.5 w-3.5" /> {t('share.regenerate')}
          </button>
        </div>
      )}
    </section>
  );
}
