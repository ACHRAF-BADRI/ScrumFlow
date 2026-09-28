import { Suspense, lazy, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { useTheme } from './context/ThemeContext';
import AppLayout from './components/layout/AppLayout';
import AppToaster from './components/ui/AppToaster';
import { TourProvider } from './components/tour/TourProvider';
import { EmptyState, PageLoader } from './components/ui/Feedback';
import AuthPage from './pages/AuthPage';
import ProjectsPage from './pages/ProjectsPage';
import AccountPage from './pages/AccountPage';
import MyWorkPage from './pages/MyWorkPage';
import ActivityView from './pages/views/ActivityView';
import CalendarView from './pages/views/CalendarView';
import RetroView from './pages/views/RetroView';
import InvitePage from './pages/InvitePage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import ProjectPage from './pages/ProjectPage';
import TableView from './pages/views/TableView';
import BoardView from './pages/views/BoardView';
import TeamView from './pages/views/TeamView';
import HistoryView from './pages/views/HistoryView';
import StandupView from './pages/views/StandupView';
import PokerView from './pages/views/PokerView';
import SharedBoardPage from './pages/SharedBoardPage';
import SprintReportPage from './pages/SprintReportPage';
import OAuthPage from './pages/OAuthPage';

// Charts are heavy: load them only when the dashboard is opened
const DashboardView = lazy(() => import('./pages/views/DashboardView'));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <RealtimeProvider>
      <ProjectsProvider>
        <TourProvider>{children}</TourProvider>
      </ProjectsProvider>
    </RealtimeProvider>
  );
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/" replace /> : children;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      illustration="notFound"
      title={t('errors.pageNotFound')}
      text={t('errors.pageNotFoundText')}
      action={
        <Link to="/" className="btn-primary">
          {t('errors.goHome')}
        </Link>
      }
    />
  );
}

/** Apply the theme saved on the profile when the user logs in on a new device. */
function useProfileTheme() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  useEffect(() => {
    if (user?.theme) setTheme(user.theme);
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function App() {
  useProfileTheme();

  return (
    <>
      <Routes>
        <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        {/* Public: these links must work whether or not someone is signed in */}
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/share/:token" element={<SharedBoardPage />} />
        <Route path="/oauth" element={<OAuthPage />} />
        {/* Printable page: outside the app layout */}
        <Route path="/projects/:projectId/report" element={<RequireAuth><SprintReportPage /></RequireAuth>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<ProjectsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="my-work" element={<MyWorkPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />}>
            <Route index element={<TableView />} />
            <Route path="board" element={<BoardView />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="standup" element={<StandupView />} />
            <Route path="poker" element={<PokerView />} />
            <Route path="retro/:sprintId" element={<RetroView />} />
            <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><DashboardView /></Suspense>} />
            <Route path="activity" element={<ActivityView />} />
            <Route path="history" element={<HistoryView />} />
            <Route path="team" element={<TeamView />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <AppToaster />
    </>
  );
}
