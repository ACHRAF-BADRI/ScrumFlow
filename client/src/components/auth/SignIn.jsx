import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_URL, errorMessage } from '../../lib/api';
import { useServerConfig } from '../../lib/serverConfig';
import { Spinner } from '../ui/Feedback';

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export const GitHubMark = () => (
  <svg viewBox="0 0 16 16" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/** GitLab tanuki */
export const GitLabMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#E24329" d="m12 22.3 4.1-12.6H7.9z" />
    <path fill="#FC6D26" d="M12 22.3 7.9 9.7H2.2z" />
    <path fill="#FCA326" d="M2.2 9.7 1 13.5c-.1.3 0 .7.3.9L12 22.3z" />
    <path fill="#E24329" d="M2.2 9.7h5.7L5.4 2.2c-.1-.4-.7-.4-.8 0z" />
    <path fill="#FC6D26" d="m12 22.3 4.1-12.6h5.7z" />
    <path fill="#FCA326" d="m21.8 9.7 1.2 3.8c.1.3 0 .7-.3.9L12 22.3z" />
    <path fill="#E24329" d="M21.8 9.7h-5.7l2.5-7.5c.1-.4.7-.4.8 0z" />
  </svg>
);

const BitbucketMark = () => (
  <svg viewBox="0 0 32 32" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#2684FF" d="M2 3.5a1 1 0 0 0-1 1.2l4 24.3a1.4 1.4 0 0 0 1.4 1.2h19.2a1 1 0 0 0 1-.9l4-24.6a1 1 0 0 0-1-1.2zm16.8 17.6h-6.1l-1.7-8.7h9.3z" />
  </svg>
);

const MicrosoftMark = () => (
  <svg viewBox="0 0 21 21" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#f25022" d="M1 1h9v9H1z" />
    <path fill="#7fba00" d="M11 1h9v9h-9z" />
    <path fill="#00a4ef" d="M1 11h9v9H1z" />
    <path fill="#ffb900" d="M11 11h9v9h-9z" />
  </svg>
);

/** "Continue with Google / GitHub", shown only for the providers configured on the server. */
export function OAuthButtons() {
  const { t, i18n } = useTranslation();
  const { oauth } = useServerConfig();
  const list = [
    ['google', 'Google', GoogleMark],
    ['microsoft', 'Microsoft', MicrosoftMark],
    ['github', 'GitHub', GitHubMark],
    ['gitlab', 'GitLab', GitLabMark],
    ['bitbucket', 'Bitbucket', BitbucketMark],
  ].filter(([id]) => oauth?.[id]);
  if (!list.length) return null;
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  return (
    <div className="mt-8 space-y-4">
      <div className={list.length > 1 && list.length !== 3 ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
        {list.map(([id, name, Mark], index) => (
          <a
            key={id}
            style={list.length > 3 && list.length % 2 === 1 && index === list.length - 1 ? { gridColumn: '1 / -1' } : undefined} href={`${API_URL}/api/auth/oauth/${id}?lang=${lang}`} className="btn-secondary h-11 justify-center" data-testid={`oauth-${id}`} aria-label={t('auth.continueWith', { name })}>
            <Mark /> {list.length > 3 ? name : t('auth.continueWith', { name })}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> {t('auth.orEmail')} <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/** Second step of the login: 6-digit code from the authenticator app, or a recovery code. */
export function TwoFactorForm({ ticket, onDone, onCancel }) {
  const { t } = useTranslation();
  const { verifyTwoFactor } = useAuth();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await verifyTwoFactor(ticket, code);
      onDone(user);
    } catch (err) {
      toast.error(errorMessage(err));
      if (err.response?.data?.code === 'errors.ticketExpired') onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" data-testid="two-factor">
      <div className="flex items-start gap-3 rounded-xl bg-brand/5 p-3.5 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p>{recovery ? t('twoFactor.recoveryPrompt') : t('twoFactor.prompt')}</p>
      </div>
      <input
        autoFocus
        key={recovery ? 'recovery' : 'code'}
        className="input h-12 text-center font-mono text-xl tracking-[0.4em]"
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={recovery ? 9 : 6}
        placeholder={recovery ? 'xxxx-xxxx' : '000000'}
        value={code}
        onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
        aria-label={t('twoFactor.code')}
      />
      <button type="submit" className="btn-primary h-11 w-full text-base" disabled={busy || code.length < (recovery ? 9 : 6)}>
        {busy && <Spinner className="h-4 w-4" />}
        {t('twoFactor.verify')}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => (setRecovery((r) => !r), setCode(''))}>
          {recovery ? t('twoFactor.useApp') : t('twoFactor.useRecovery')}
        </button>
        <button type="button" className="text-muted hover:text-ink" onClick={onCancel}>
          {t('common.back')}
        </button>
      </div>
    </form>
  );
}
