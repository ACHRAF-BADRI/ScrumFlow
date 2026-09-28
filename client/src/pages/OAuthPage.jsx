import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { PageLoader } from '../components/ui/Feedback';
import AuthCard from '../components/layout/AuthCard';
import { TwoFactorForm } from '../components/auth/SignIn';

/**
 * Where Google / GitHub send the user back. The API puts the session token
 * (or a two-step ticket) in the URL fragment, which never reaches a server.
 */
export default function OAuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithToken } = useAuth();
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const ticket = params.get('ticket');

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    // Drop the token from the address bar and the history
    window.history.replaceState(null, '', window.location.pathname);
    const token = params.get('token');
    if (!token) {
      if (!ticket) navigate('/login', { replace: true });
      return;
    }
    signInWithToken(token)
      .then((user) => {
        toast.success(t(params.get('new') ? 'auth.welcome' : 'auth.welcomeBack', { name: user.name.split(' ')[0] }));
        navigate('/', { replace: true });
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        navigate('/login', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ticket) return <PageLoader />;
  return (
    <AuthCard>
      <h1 className="text-2xl font-extrabold tracking-tight">{t('twoFactor.title')}</h1>
      <TwoFactorForm
        ticket={ticket}
        onDone={(user) => {
          toast.success(t('auth.welcomeBack', { name: user.name.split(' ')[0] }));
          navigate('/', { replace: true });
        }}
        onCancel={() => navigate('/login', { replace: true })}
      />
    </AuthCard>
  );
}
