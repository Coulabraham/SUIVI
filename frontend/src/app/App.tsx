import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { WorkspaceLayout } from '../components/WorkspaceLayout';
import { useConnectivityStore } from '../stores/connectivity';
import { OverviewPage, DiagnosticPage } from '../features/system/SystemPages';
import { LoginPage, ProfilePage } from '../features/authentication/AuthPages';
import { useAuthStore } from '../stores/auth';
import { restoreSession } from '../services/api';
import { usePwaStore } from '../pwa/client';
const PwaUpdateNotice = lazy(() =>
  import('../pwa/PwaUpdateNotice').then((m) => ({ default: m.PwaUpdateNotice })),
);
const InstallationPage = lazy(() =>
  import('../pwa/InstallationPage').then((m) => ({ default: m.InstallationPage })),
);
const NotificationsPage = lazy(() =>
  import('../features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AuditPage = lazy(() =>
  import('../features/audit/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const DepartmentsPage = lazy(() =>
  import('../features/departments/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })),
);
const ManagersPage = lazy(() =>
  import('../features/managers/ManagersPage').then((m) => ({ default: m.ManagersPage })),
);
const MembersPage = lazy(() =>
  import('../features/members/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const PaymentsPage = lazy(() =>
  import('../features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
);
const ObjectivesPage = lazy(() =>
  import('../features/objectives/ObjectivesPage').then((m) => ({ default: m.ObjectivesPage })),
);
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuthStore();
  if (!ready) return <p role="status">Vérification de la session…</p>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.mustChangePassword) return <Navigate to="/profil" replace />;
  if (admin && user.role !== 'SUPER_ADMIN')
    return (
      <p role="alert" className="error-box">
        Cette page est réservée au Super Administrateur.
      </p>
    );
  return children;
}

function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8">
      <h1 className="page-title">Page introuvable</h1>
      <Link to="/" className="primary-button mt-6">
        Revenir à l’accueil
      </Link>
    </div>
  );
}

export function App() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const authScreen = !user && ['/', '/connexion'].includes(location.pathname);
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const setOnline = useConnectivityStore((state) => state.setOnline);
  useEffect(() => {
    if (navigator.onLine) void restoreSession().catch(() => useAuthStore.getState().finish());
    else useAuthStore.getState().finish();
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [setOnline]);
  return (
    <WorkspaceLayout
      key={user ? [user.id, user.role, user.departmentId].join(':') : 'anonymous'}
      authScreen={authScreen}
    >
      {updateAvailable && (
        <Suspense fallback={null}>
          <PwaUpdateNotice />
        </Suspense>
      )}
      <Suspense fallback={<p role="status">Chargement de la page…</p>}>
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to={user.mustChangePassword ? '/profil' : '/tableau-de-bord'} replace />
              ) : (
                <Navigate to="/connexion" replace />
              )
            }
          />
          <Route path="/presentation" element={<OverviewPage />} />
          <Route path="/diagnostic" element={<DiagnosticPage />} />
          <Route path="/installation" element={<InstallationPage />} />
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route
            path="/notifications"
            element={
              <Protected>
                <NotificationsPage />
              </Protected>
            }
          />
          <Route
            path="/audit"
            element={
              <Protected admin>
                <AuditPage />
              </Protected>
            }
          />
          <Route
            path="/tableau-de-bord"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/departements"
            element={
              <Protected admin>
                <DepartmentsPage />
              </Protected>
            }
          />
          <Route
            path="/responsables"
            element={
              <Protected admin>
                <ManagersPage />
              </Protected>
            }
          />
          <Route
            path="/membres"
            element={
              <Protected>
                <MembersPage key={location.search} />
              </Protected>
            }
          />
          <Route
            path="/encaissements"
            element={
              <Protected>
                <PaymentsPage />
              </Protected>
            }
          />
          <Route
            path="/objectifs"
            element={
              <Protected>
                <ObjectivesPage />
              </Protected>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </WorkspaceLayout>
  );
}
