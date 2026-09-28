import { useEffect, useState } from 'react';
import { Check, Copy, Download, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { downloadText } from '../../lib/exportCsv';
import { Modal } from '../ui/Modal';

/** Two-step verification: scan a QR code, confirm with a code, keep the recovery codes. */
export default function SecuritySection({ Section }) {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const enabled = Boolean(user.twoFactor?.enabled);
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [codes, setCodes] = useState(null);
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/me/2fa/setup');
      const qr = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 200 });
      setSetup({ secret: data.secret, qr });
      setCode('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/me/2fa/enable', { code });
      setUser(data.user);
      setSetup(null);
      setCodes(data.recoveryCodes);
      toast.success(t('twoFactor.enabled'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const value = password.trim();
      const { data } = await api.post('/auth/me/2fa/disable', /^\d{6}$/.test(value) ? { code: value } : { password: value });
      setUser(data.user);
      setDisabling(false);
      setPassword('');
      toast.success(t('twoFactor.disabled'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!disabling) setPassword('');
  }, [disabling]);

  return (
    <Section icon={ShieldCheck} title={t('twoFactor.title')} text={t('twoFactor.text')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`badge ${enabled ? '' : 'opacity-80'}`} style={{ '--c': enabled ? '#00c875' : '#a1a3b8' }} data-testid="twofa-status">
          {enabled ? <Check className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {enabled ? t('twoFactor.on') : t('twoFactor.off')}
        </span>
        <div className="ml-auto">
          {enabled ? (
            <button type="button" className="btn-secondary" onClick={() => setDisabling(true)}>
              {t('twoFactor.disable')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>
              {t('twoFactor.enable')}
            </button>
          )}
        </div>
      </div>
      {(user.oauth?.google || user.oauth?.github || user.oauth?.microsoft) && (
        <p className="mt-3 text-xs text-muted">
          {t('twoFactor.linked', { list: [user.oauth.google && 'Google', user.oauth.microsoft && 'Microsoft', user.oauth.github && 'GitHub'].filter(Boolean).join(', ') })}
        </p>
      )}

      <Modal
        open={Boolean(setup)}
        onClose={() => setSetup(null)}
        title={t('twoFactor.setupTitle')}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSetup(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="totp-enable" className="btn-primary" disabled={busy || code.length !== 6}>
              {t('twoFactor.confirm')}
            </button>
          </>
        }
      >
        {setup && (
          <form id="totp-enable" onSubmit={enable} className="space-y-4 text-sm">
            <p>{t('twoFactor.step1')}</p>
            <div className="flex flex-col items-center gap-2">
              <img src={setup.qr} alt={t('twoFactor.qr')} className="h-44 w-44 rounded-xl border border-line bg-white p-1" />
              <p className="text-xs text-muted">{t('twoFactor.manual')}</p>
              <code className="select-all break-all rounded-lg bg-surface-2 px-2 py-1 text-center font-mono text-xs" data-testid="totp-secret">
                {setup.secret}
              </code>
            </div>
            <label className="block">
              <span className="label">{t('twoFactor.step2')}</span>
              <input
                autoFocus
                className="input h-11 text-center font-mono text-lg tracking-[0.4em]"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-label={t('twoFactor.code')}
              />
            </label>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(codes)}
        onClose={() => setCodes(null)}
        title={t('twoFactor.recoveryTitle')}
        footer={
          <button type="button" className="btn-primary" onClick={() => setCodes(null)}>
            {t('twoFactor.saved')}
          </button>
        }
      >
        {codes && (
          <div className="space-y-4 text-sm">
            <p>{t('twoFactor.recoveryText')}</p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3 font-mono" data-testid="recovery-codes">
              {codes.map((c) => (
                <li key={c} className="text-center">
                  {c}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(codes.join('\n'));
                  toast.success(t('share.copied'));
                }}
              >
                <Copy className="h-4 w-4" /> {t('twoFactor.copy')}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => downloadText('scrumflow-recovery-codes.txt', codes.join('\r\n'), 'text/plain;charset=utf-8')}>
                <Download className="h-4 w-4" /> {t('twoFactor.download')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={disabling}
        onClose={() => setDisabling(false)}
        title={t('twoFactor.disable')}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDisabling(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="totp-disable" className="btn-danger" disabled={busy || !password.trim()}>
              {t('twoFactor.disable')}
            </button>
          </>
        }
      >
        <form id="totp-disable" onSubmit={disable} className="space-y-3 text-sm">
          <p>{t('twoFactor.disableText')}</p>
          <input autoFocus type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('twoFactor.passwordOrCode')} aria-label={t('twoFactor.passwordOrCode')} />
        </form>
      </Modal>
    </Section>
  );
}
