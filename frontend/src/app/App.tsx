import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useConnectivityStore } from '../stores/connectivity';
import { OverviewPage, DiagnosticPage } from '../features/system/SystemPages';
import { LoginPage, ProfilePage } from '../features/authentication/AuthPages';
import { useAuthStore } from '../stores/auth';
import { api, restoreSession, errorMessage } from '../services/api';
import { useUnread } from '../features/notifications/useUnread';
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
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [logoutError, setLogoutError] = useState('');
  const unread = useUnread();
  const updateAvailable = usePwaStore((state) => state.updateAvailable);
  const navigation = user
    ? [
        { to: '/tableau-de-bord', text: 'Tableau de bord', icon: 'grid' as const },
        ...(user.role === 'SUPER_ADMIN'
          ? [
              { to: '/departements', text: 'Départements', icon: 'grid' as const },
              { to: '/responsables', text: 'Responsables', icon: 'grid' as const },
            ]
          : []),
        { to: '/membres', text: 'Membres', icon: 'grid' as const },
        { to: '/encaissements', text: 'Encaissements', icon: 'grid' as const },
        { to: '/objectifs', text: 'Objectifs', icon: 'grid' as const },
        ...(!user.mustChangePassword
          ? [
              {
                to: '/notifications',
                text:
                  'Notifications' +
                  (unread.data === undefined
                    ? unread.isError
                      ? ' · Indisponibles'
                      : ' · …'
                    : ' · ' + unread.data),
                icon: 'pulse' as const,
              },
              ...(user.role === 'SUPER_ADMIN'
                ? [{ to: '/audit', text: 'Journal d’audit', icon: 'pulse' as const }]
                : []),
            ]
          : []),
        { to: '/profil', text: 'Mon profil', icon: 'grid' as const },
        { to: '/diagnostic', text: 'Diagnostic', icon: 'pulse' as const },
        { to: '/installation', text: 'Installer SUIVI', icon: 'grid' as const },
      ]
    : [
        { to: '/', text: 'Vue d’ensemble', icon: 'grid' as const },
        { to: '/connexion', text: 'Connexion', icon: 'grid' as const },
        { to: '/diagnostic', text: 'Diagnostic', icon: 'pulse' as const },
        { to: '/installation', text: 'Installer SUIVI', icon: 'grid' as const },
      ];
  const online = useConnectivityStore((state) => state.online);
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
    <div className="min-h-screen bg-[#f7f8f5] text-stone-800 lg:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed"
      >
        Aller au contenu
      </a>
      <aside className="border-b border-stone-200 bg-white px-5 py-5 lg:fixed lg:inset-y-0 lg:w-60 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
        <Link to="/" aria-label="SUIVI, accueil" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#123e38] text-xl font-bold text-[#e4edc9]">
            S
          </span>
          <span className="text-2xl font-bold tracking-[.15em] text-[#173d34]">SUIVI</span>
        </Link>
        <p className="mt-2 hidden pl-[3.25rem] text-[11px] text-stone-400 lg:block">
          Chaque contribution compte
        </p>
        <p className="mt-12 mb-4 hidden text-[10px] font-semibold tracking-[.17em] text-stone-400 lg:block">
          VOTRE ESPACE
        </p>
        <nav
          aria-label="Navigation principale"
          className="mt-5 flex flex-wrap gap-2 lg:mt-0 lg:flex-col"
        >
          {navigation.map(({ to, text, icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-[#edf3e9] text-[#234d3c]' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'}`
              }
            >
              <Icon name={icon} />
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 hidden rounded-xl bg-[#f6f7f2] p-4 lg:block">
          <p className="text-xs font-semibold text-stone-700">
            {user ? user.firstName + ' ' + user.lastName : 'Chaque contribution compte'}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            {user?.role === 'SUPER_ADMIN'
              ? 'Super Administrateur'
              : user
                ? 'Responsable de département'
                : 'Gestion des contributions'}
            <br />
            Version 0.1.0
          </p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-60">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-stone-200/80 bg-white/80 px-6 sm:px-10">
          <p className="text-xs text-stone-400">
            Organisation <span className="mx-2 text-stone-300">/</span>
            <span className="text-stone-600">Espace de travail</span>
          </p>
          <span
            role="status"
            className={`flex items-center gap-2 text-xs font-medium ${online ? 'text-[#49745b]' : 'text-amber-800'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            {online ? 'Réseau connecté' : 'Hors connexion'}
          </span>
          {user && (
            <button
              className="text-xs underline"
              onClick={async () => {
                setLogoutError('');
                try {
                  await api.post('/auth/logout');
                  clear();
                  client.clear();
                  navigate('/connexion');
                } catch (e) {
                  setLogoutError(errorMessage(e));
                }
              }}
            >
              Se déconnecter
            </button>
          )}
        </header>
        <main id="main-content" className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10">
          {logoutError && (
            <p role="alert" className="error-box mb-5">
              Déconnexion non confirmée : {logoutError}
            </p>
          )}
          {!online && (
            <p role="status" className="notice mb-5">
              L’application est ouverte sans réseau. L’accès hors connexion aux données de votre
              département n’est pas encore activé. Les nouvelles opérations nécessitent actuellement
              le serveur.
            </p>
          )}
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
                    <Navigate
                      to={user.mustChangePassword ? '/profil' : '/tableau-de-bord'}
                      replace
                    />
                  ) : (
                    <OverviewPage />
                  )
                }
              />
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
                    <MembersPage />
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
          <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-stone-200 pt-5 text-[11px] text-stone-400">
            <span>SUIVI · Gestion des contributions</span>
            <span>Version en développement · Données confirmées par le serveur</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
