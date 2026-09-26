import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, KanbanSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { STATUSES } from '../lib/constants';
import { Logo } from '../components/layout/AppLayout';
import { LanguageSwitcher, ThemeToggle } from '../components/layout/Preferences';
import { Spinner } from '../components/ui/Feedback';

function Hero() {
  const { t } = useTranslation();
  const features = [
    { icon: KanbanSquare, label: t('auth.featureBoards') },
    { icon: BarChart3, label: t('auth.featureSprints') },
    { icon: Users, label: t('auth.featureTeam') },
  ];
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#6161ff] via-[#5151e6] to-[#a25ddc] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#00c875]/20 blur-3xl" />
      <div className="relative">
        <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">{t('auth.heroTitle')}</h2>
        <p className="mt-4 max-w-md text-lg text-white/80">{t('auth.heroText')}</p>
        <ul className="mt-8 space-y-3">
          {features.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      {/* Decorative mini board */}
      <div className="relative grid grid-cols-3 gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
        {STATUSES.filter((s) => s.id !== 'review' && s.id !== 'stuck').map((s, col) => (
          <div key={s.id} className="space-y-2">
            <div className="h-1.5 rounded-full" style={{ background: s.color }} />
            {Array.from({ length: 3 - col }, (_, i) => (
              <div key={i} className="rounded-lg bg-white/90 p-2.5">
                <div className="h-2 w-4/5 rounded bg-[#323338]/20" />
                <div className="mt-2 flex items-center justify-between">
                  <div className="h-2 w-8 rounded-full" style={{ background: s.color }} />
                  <div className="h-4 w-4 rounded-full bg-[#6161ff]/40" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthPage({ mode }) {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === 'login';

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = isLogin ? await login(form.email, form.password) : await register(form.name, form.email, form.password);
      toast.success(t('auth.welcome', { name: user.name.split(' ')[0] }));
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {!isLogin && (
              <div>
                <label className="label" htmlFor="name">
                  {t('auth.name')}
                </label>
                <input id="name" className="input h-11" value={form.name} onChange={set('name')} autoComplete="name" required maxLength={60} />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">
                {t('auth.email')}
              </label>
              <input id="email" type="email" className="input h-11" value={form.email} onChange={set('email')} autoComplete="email" required />
            </div>
            <div>
              <label className="label" htmlFor="password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input h-11 pr-11"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted hover:text-ink"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label="toggle password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary h-11 w-full text-base" disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4" />}
              {isLogin ? t('auth.login') : t('auth.register')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-semibold text-brand hover:underline">
              {isLogin ? t('auth.register') : t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
      <Hero />
    </div>
  );
}
