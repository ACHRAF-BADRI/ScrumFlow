import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import AuthCard from '../components/layout/AuthCard';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, PageLoader, Spinner } from '../components/ui/Feedback';

/** Fetches the public details of an invitation (used here and on the sign-up page). */
export function useInvitation(token) {
  const [state, setState] = useState({ loading: Boolean(token), invitation: null, error: null });
  useEffect(() => {
    if (!token) return;
    api
      .get(`/invitations/${token}`)
      .then(({ data }) => setState({ loading: false, invitation: data.invitation, error: null }))
      .catch((error) => setState({ loading: false, invitation: null, error }));
  }, [token]);
  return state;
}

/** "Nora invited you to join Website Redesign as Member" banner. */
export function InviteBanner({ invitation }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/25 bg-brand/5 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white" style={{ background: invitation.project.color }}>
        {invitation.project.key.slice(0, 3)}
      </span>
      <p className="text-sm">
        {t('invite.banner', { inviter: invitation.inviterName, project: invitation.project.name, role: t(`invite.roleWord.${invitation.role}`) })}
      </p>
    </div>
  );
}

export default function InvitePage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const { user, loading: authLoading, logout } = useAuth();
  const { loading, invitation, error } = useInvitation(token);
  const [joining, setJoining] = useState(false);

  if (loading || authLoading) return <PageLoader />;

  if (error || !invitation) {
    return (
      <AuthCard>
        <EmptyState
          compact
          illustration="error"
          title={t('errors.inviteInvalid')}
          text={t('invite.invalidText')}
          action={
            <Link to={user ? '/' : '/login'} className="btn-primary">
              {user ? t('errors.goHome') : t('auth.login')}
            </Link>
          }
        />
      </AuthCard>
    );
  }

  const accept = async () => {
    setJoining(true);
    try {
      const { data } = await api.post(`/invitations/${token}/accept`);
      toast.success(t('invite.joined', { project: invitation.project.name }));
      // Full navigation so the project list is loaded fresh
      window.location.assign(`/projects/${data.projectId}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setJoining(false);
    }
  };

  const sameAccount = user && user.email === invitation.email;

  return (
    <AuthCard>
      <h1 className="text-2xl font-extrabold tracking-tight">{t('invite.title')}</h1>
      <div className="mt-5">
        <InviteBanner invitation={invitation} />
      </div>
      <p className="mt-4 text-sm text-muted">{t('invite.sentTo', { email: invitation.email })}</p>

      {!user && (
        <div className="mt-6 space-y-2">
          <Link to={`/register?invite=${token}`} className="btn-primary h-11 w-full">
            {t('invite.createAccount')}
          </Link>
          <Link to={`/login?invite=${token}`} className="btn-secondary h-11 w-full">
            {t('invite.haveAccount')}
          </Link>
        </div>
      )}

      {sameAccount && (
        <button type="button" onClick={accept} disabled={joining} className="btn-primary mt-6 h-11 w-full">
          {joining && <Spinner className="h-4 w-4" />}
          {t('invite.join')}
        </button>
      )}

      {user && !sameAccount && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2/70 p-3 text-sm">
            <Avatar user={user} size="md" />
            <span>{t('invite.otherAccount', { email: user.email })}</span>
          </div>
          <button
            type="button"
            className="btn-secondary h-11 w-full"
            onClick={() => {
              logout();
              window.location.assign(`/login?invite=${token}`);
            }}
          >
            {t('invite.switchAccount')}
          </button>
        </div>
      )}
    </AuthCard>
  );
}
