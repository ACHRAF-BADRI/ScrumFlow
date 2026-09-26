import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import AuthCard from '../components/layout/AuthCard';
import { EmptyState, Spinner } from '../components/ui/Feedback';

function IconTitle({ icon: Icon, title, text }) {
  return (
    <div className="mb-6">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {text && <p className="mt-1.5 text-sm text-muted">{text}</p>}
    </div>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <AuthCard>
        <IconTitle icon={MailCheck} title={t('password.checkInbox')} text={t('password.checkInboxText', { email: email.trim() })} />
        <p className="text-xs text-muted">{t('password.spamHint')}</p>
        <Link to="/login" className="btn-secondary mt-6 w-full">
          {t('password.backToLogin')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <IconTitle icon={KeyRound} title={t('password.forgotTitle')} text={t('password.forgotText')} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="forgot-email">
            {t('auth.email')}
          </label>
          <input id="forgot-email" type="email" className="input h-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </div>
        <button type="submit" className="btn-primary h-11 w-full" disabled={sending || !email.trim()}>
          {sending && <Spinner className="h-4 w-4" />}
          {t('password.sendLink')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-brand hover:underline">
          {t('password.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const { signInWith } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const mismatch = form.confirm && form.password !== form.confirm;
  const tooShort = form.password && form.password.length < 6;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password: form.password });
      const user = signInWith(data);
      toast.success(t('password.resetDone', { name: user.name.split(' ')[0] }));
      navigate('/', { replace: true });
    } catch (err) {
      if (err.response?.data?.code === 'errors.resetInvalid') setInvalid(true);
      else toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  if (invalid) {
    return (
      <AuthCard>
        <EmptyState
          compact
          illustration="error"
          title={t('errors.resetInvalid')}
          text={t('password.invalidText')}
          action={
            <Link to="/forgot-password" className="btn-primary">
              {t('password.newLink')}
            </Link>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <IconTitle icon={KeyRound} title={t('password.resetTitle')} text={t('password.resetText')} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="reset-password">
            {t('account.newPassword')}
          </label>
          <input id="reset-password" type="password" className="input h-11" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" required autoFocus />
          {tooShort && <p className="mt-1 text-xs text-[#e2445c]">{t('errors.passwordTooShort')}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reset-confirm">
            {t('account.confirmPassword')}
          </label>
          <input id="reset-confirm" type="password" className="input h-11" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" required />
          {mismatch && <p className="mt-1 text-xs text-[#e2445c]">{t('account.passwordMismatch')}</p>}
        </div>
        <button type="submit" className="btn-primary h-11 w-full" disabled={saving || !form.password || tooShort || mismatch || !form.confirm}>
          {saving && <Spinner className="h-4 w-4" />}
          {t('password.saveAndSignIn')}
        </button>
      </form>
    </AuthCard>
  );
}
