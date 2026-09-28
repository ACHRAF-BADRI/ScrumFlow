import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Bell, Check, Eye, EyeOff, KeyRound, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { api, errorMessage } from '../lib/api';
import { PROJECT_COLORS } from '../lib/constants';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import SecuritySection from '../components/auth/SecuritySection';

function Section({ icon: Icon, title, text, children, danger }) {
  return (
    <section className={clsx('card p-5 sm:p-6', danger && 'border-[#e2445c]/40')}>
      <div className="mb-5 flex items-start gap-3">
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-[#e2445c]/10 text-[#e2445c]' : 'bg-brand/10 text-brand')}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className={clsx('text-base font-bold', danger && 'text-[#e2445c]')}>{title}</h2>
          {text && <p className="text-sm text-muted">{text}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** "Forgot it?" next to a current password field: emails a reset link to the signed-in user. */
function ForgotCurrentPassword() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [state, setState] = useState('idle'); // idle | sending | sent

  const send = async () => {
    setState('sending');
    try {
      await api.post('/auth/forgot-password', { email: user.email });
      setState('sent');
      toast.success(t('account.resetSent', { email: user.email }));
    } catch (err) {
      toast.error(errorMessage(err));
      setState('idle');
    }
  };

  return (
    <button type="button" onClick={send} disabled={state !== 'idle'} className="mb-1.5 text-xs font-semibold text-brand hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline">
      {state === 'sent' ? t('account.resetSentShort') : t('account.forgotCurrent')}
    </button>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="input pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted hover:text-ink"
        aria-label="toggle password"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ProfileSection() {
  const { t } = useTranslation();
  const { user, saveProfile } = useAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email, avatarColor: user.avatarColor });
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm({ name: user.name, email: user.email, avatarColor: user.avatarColor }), [user.name, user.email, user.avatarColor]);

  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const dirty = form.name.trim() !== user.name || emailChanged || form.avatarColor !== user.avatarColor;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile({ name: form.name.trim(), email: form.email.trim(), avatarColor: form.avatarColor, ...(emailChanged && { currentPassword }) });
      setCurrentPassword('');
      toast.success(t('account.profileSaved'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={UserRound} title={t('account.profile')} text={t('account.profileText')}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...user, name: form.name || user.name, avatarColor: form.avatarColor }} size="lg" className="!h-14 !w-14 !text-lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{form.name || user.name}</p>
            <p className="truncate text-sm text-muted">{form.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="account-name">
              {t('auth.name')}
            </label>
            <input id="account-name" className="input" value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label" htmlFor="account-email">
              {t('auth.email')}
            </label>
            <input id="account-email" type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
        </div>

        {emailChanged && (
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="label" htmlFor="account-email-password">
                {t('account.currentPassword')}
              </label>
              <ForgotCurrentPassword />
            </div>
            <p className="mb-2 text-xs text-muted">{t('account.emailPasswordHint')}</p>
            <PasswordInput id="account-email-password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          </div>
        )}

        <div>
          <span className="label">{t('account.avatarColor')}</span>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm((f) => ({ ...f, avatarColor: color }))}
                className={clsx('flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110', form.avatarColor === color && 'ring-2 ring-offset-2 ring-offset-surface')}
                style={{ background: color, '--tw-ring-color': color }}
                aria-label={color}
              >
                {form.avatarColor === color && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!dirty || saving || !form.name.trim() || (emailChanged && !currentPassword)}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Section>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const { user, saveProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const enabled = user.emailNotifications !== false;

  const toggle = async () => {
    setSaving(true);
    try {
      await saveProfile({ emailNotifications: !enabled });
      toast.success(!enabled ? t('account.notificationsOn') : t('account.notificationsOff'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={Bell} title={t('account.notifications')} text={t('account.notificationsText')}>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line p-4 transition hover:bg-surface-2/50">
        <span>
          <span className="block text-sm font-semibold">{t('account.emailNotifications')}</span>
          <span className="block text-xs text-muted">{t('account.emailNotificationsText')}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={toggle}
          className={clsx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', enabled ? 'bg-brand' : 'bg-line')}
        >
          <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
        </button>
      </label>
    </Section>
  );
}

function PasswordSection() {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const mismatch = form.confirm && form.next !== form.confirm;
  const tooShort = form.next && form.next.length < 6;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success(t('account.passwordSaved'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={KeyRound} title={t('account.password')} text={t('account.passwordText')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="label" htmlFor="pw-current">
              {t('account.currentPassword')}
            </label>
            <ForgotCurrentPassword />
          </div>
          <PasswordInput id="pw-current" value={form.current} onChange={(v) => setForm((f) => ({ ...f, current: v }))} autoComplete="current-password" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw-new">
              {t('account.newPassword')}
            </label>
            <PasswordInput id="pw-new" value={form.next} onChange={(v) => setForm((f) => ({ ...f, next: v }))} autoComplete="new-password" />
            {tooShort && <p className="mt-1 text-xs text-[#e2445c]">{t('errors.passwordTooShort')}</p>}
          </div>
          <div>
            <label className="label" htmlFor="pw-confirm">
              {t('account.confirmPassword')}
            </label>
            <PasswordInput id="pw-confirm" value={form.confirm} onChange={(v) => setForm((f) => ({ ...f, confirm: v }))} autoComplete="new-password" />
            {mismatch && <p className="mt-1 text-xs text-[#e2445c]">{t('account.passwordMismatch')}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving || !form.current || !form.next || tooShort || mismatch || !form.confirm}>
            {saving ? t('common.saving') : t('account.updatePassword')}
          </button>
        </div>
      </form>
    </Section>
  );
}

function DeleteSection() {
  const { t } = useTranslation();
  const { user, deleteAccount } = useAuth();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // What will happen to the projects the user owns
  const { solo, shared } = useMemo(() => {
    const owned = projects.filter((p) => String(p.owner) === String(user._id));
    return { solo: owned.filter((p) => p.members.length <= 1), shared: owned.filter((p) => p.members.length > 1) };
  }, [projects, user._id]);

  const matches = confirm.trim() === user.name.trim();

  const close = () => {
    setOpen(false);
    setConfirm('');
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteAccount(confirm.trim());
      toast.success(t('account.deleted'));
      navigate('/register', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Section icon={AlertTriangle} title={t('account.dangerZone')} text={t('account.deleteText')} danger>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> {t('account.delete')}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={t('account.deleteTitle')}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-danger" onClick={remove} disabled={!matches || deleting}>
              {deleting ? t('common.saving') : t('account.deleteForever')}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted">{t('account.deleteWarning')}</p>
          <ul className="space-y-2 rounded-xl bg-surface-2/70 p-4">
            <li>
              <b>{t('account.soloProjects', { count: solo.length })}</b>
              {solo.length > 0 && <span className="text-muted">: {solo.map((p) => p.name).join(', ')}</span>}
            </li>
            <li>
              <b>{t('account.sharedProjects', { count: shared.length })}</b>
              {shared.length > 0 && <span className="text-muted">: {shared.map((p) => p.name).join(', ')}</span>}
            </li>
            <li className="text-muted">{t('account.tasksUnassigned')}</li>
          </ul>
          <div>
            <label className="label normal-case tracking-normal" htmlFor="delete-confirm">
              {t('account.typeName')} <span className="font-bold text-ink">{user.name}</span>
            </label>
            <input
              id="delete-confirm"
              className={clsx('input', confirm && !matches && 'border-[#e2445c] focus:border-[#e2445c] focus:ring-[#e2445c]/20')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={user.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </Section>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('account.title')}</h1>
        <p className="text-sm text-muted">{t('account.subtitle')}</p>
      </div>
      <ProfileSection />
      <NotificationsSection />
      {!user.isRootAdmin && <PasswordSection />}
      <SecuritySection Section={Section} />
      {user.isRootAdmin ? <p className="text-center text-xs text-muted">{t('admin.rootAccountNote')}</p> : <DeleteSection />}
    </div>
  );
}
