import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icon';
import { useAuthStore } from '../stores/auth';
import { useConnectivityStore } from '../stores/connectivity';
import { useUnread } from '../features/notifications/useUnread';
import { api, errorMessage } from '../services/api';

type Entry = { to: string; text: string; icon: IconName };
function Connection() {
  const online = useConnectivityStore((s) => s.online);
  return (
    <span
      role="status"
      aria-label={online ? 'Réseau connecté' : 'Hors connexion'}
      className={`connectivity ${online ? '' : 'offline'}`}
    >
      <span className="connectivity-dot" />
      <span>{online ? 'Réseau connecté' : 'Hors connexion'}</span>
    </span>
  );
}
function Drawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const resize = () => {
      if (window.innerWidth >= 768) onClose();
    };
    window.addEventListener('resize', resize);
    return () => {
      dialog?.close();
      window.removeEventListener('resize', resize);
    };
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className="sidebar-drawer"
      aria-label="Menu de navigation"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="icon-button drawer-close"
        aria-label="Fermer le menu"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
export function WorkspaceLayout({
  authScreen,
  children,
}: {
  authScreen: boolean;
  children: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const online = useConnectivityStore((s) => s.online);
  const unread = useUnread();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const admin = user?.role === 'SUPER_ADMIN';
  const initials = user ? (user.firstName[0] ?? '') + (user.lastName[0] ?? '') : 'S';
  const role = admin ? 'Super Administrateur' : 'Responsable de département';
  const entries: Entry[] = user
    ? [
        { to: '/tableau-de-bord', text: 'Tableau de bord', icon: 'home' },
        ...(admin
          ? [
              { to: '/departements', text: 'Départements', icon: 'building' as const },
              { to: '/responsables', text: 'Responsables', icon: 'users' as const },
            ]
          : []),
        { to: '/membres', text: 'Membres', icon: 'users' },
        { to: '/encaissements', text: 'Encaissements', icon: 'wallet' },
        { to: '/objectifs', text: 'Objectifs', icon: 'target' },
        ...(!user.mustChangePassword
          ? [
              {
                to: '/notifications',
                text:
                  'Notifications · ' + (unread.isError ? 'Indisponibles' : (unread.data ?? '…')),
                icon: 'bell' as const,
              },
              ...(admin ? [{ to: '/audit', text: 'Journal d’audit', icon: 'audit' as const }] : []),
            ]
          : []),
        { to: '/profil', text: 'Mon profil', icon: 'user' },
        { to: '/installation', text: 'Installer SUIVI', icon: 'network' },
        { to: '/diagnostic', text: 'Diagnostic', icon: 'pulse' },
      ]
    : [
        { to: '/presentation', text: 'Présentation', icon: 'home' },
        { to: '/connexion', text: 'Connexion', icon: 'lock' },
        { to: '/diagnostic', text: 'Diagnostic', icon: 'pulse' },
        { to: '/installation', text: 'Installer SUIVI', icon: 'network' },
      ];
  const navigation = (close?: () => void) => (
    <div className="sidebar-content">
      <Link to="/" aria-label="SUIVI, accueil" className="sidebar-brand" onClick={close}>
        <Brand />
      </Link>
      <p className="navigation-caption">VOTRE ESPACE</p>
      <nav className="sidebar-navigation" aria-label="Navigation principale">
        {entries.map((entry) => (
          <NavLink key={entry.to} to={entry.to} end className="sidebar-link" onClick={close}>
            <Icon name={entry.icon} />
            <span>{entry.text}</span>
          </NavLink>
        ))}
      </nav>
      <Link to="/profil" className="sidebar-profile" onClick={close}>
        <span className="avatar">{initials.toUpperCase()}</span>
        <span>
          {user?.firstName} {user?.lastName}
          <small>{role}</small>
        </span>
      </Link>
    </div>
  );
  const footer = (
    <footer className={authScreen ? 'auth-footer' : 'workspace-footer'}>
      <span>SUIVI · Gestion des cotisations et encaissements</span>
      <span>Chaque contribution compte</span>
    </footer>
  );
  return (
    <div
      className={authScreen ? 'auth-shell' : `application ${user ? 'with-bottom-navigation' : ''}`}
    >
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed"
      >
        Aller au contenu
      </a>
      {authScreen ? (
        <>
          <header className="auth-topbar">
            <Link className="auth-about" to="/presentation">
              SUIVI · Votre organisation, un même objectif
            </Link>
            <Connection />
          </header>
          <main id="main-content" className="auth-main">
            {children}
            {footer}
          </main>
        </>
      ) : (
        <>
          {user ? (
            <aside className="desktop-sidebar">{navigation()}</aside>
          ) : (
            <aside className="public-navigation">
              <Link to="/" aria-label="SUIVI, accueil">
                <Brand />
              </Link>
              <nav aria-label="Navigation principale">
                {entries.map((entry) => (
                  <NavLink key={entry.to} to={entry.to} end>
                    {entry.text}
                  </NavLink>
                ))}
              </nav>
            </aside>
          )}
          <div className={user ? 'authenticated-workspace' : ''}>
            <header className="workspace-header">
              {user && (
                <button
                  type="button"
                  className="icon-button menu-toggle"
                  aria-label="Ouvrir le menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <Icon name="menu" />
                </button>
              )}
              <Link to="/" className="workspace-brand" aria-label="SUIVI, accueil">
                <Brand />
              </Link>
              {user && !user.mustChangePassword && (
                <form
                  role="search"
                  className="header-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigate(
                      '/membres' + (search.trim() ? '?q=' + encodeURIComponent(search.trim()) : ''),
                    );
                  }}
                >
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Rechercher un membre"
                    placeholder="Rechercher un membre…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="submit" aria-label="Lancer la recherche">
                    <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </form>
              )}
              <div className="header-actions">
                <Connection />
                {user && (
                  <>
                    {!user.mustChangePassword && (
                      <Link
                        to="/notifications"
                        className="icon-button notification-button"
                        aria-label="Ouvrir les notifications"
                      >
                        <Icon name="bell" />
                        {unread.data ? (
                          <span className="notification-count">
                            {unread.data > 99 ? '99+' : unread.data}
                          </span>
                        ) : null}
                      </Link>
                    )}
                    <Link
                      to="/profil"
                      aria-label="Ouvrir mon profil"
                      className="flex items-center gap-2"
                    >
                      <span className="avatar">{initials.toUpperCase()}</span>
                      <span className="header-identity">
                        {user.firstName}
                        <small>{admin ? 'Super Admin' : 'Responsable'}</small>
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Se déconnecter"
                      title="Se déconnecter"
                      onClick={async () => {
                        setError('');
                        try {
                          await api.post('/auth/logout');
                          clear();
                          queryClient.clear();
                          navigate('/connexion');
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    >
                      <Icon name="logout" />
                    </button>
                  </>
                )}
              </div>
            </header>
            <main id="main-content" className="workspace-main">
              {error && (
                <p role="alert" className="error-box mb-5">
                  Déconnexion non confirmée : {error}
                </p>
              )}
              {!online && (
                <p role="status" className="notice mb-5">
                  L’application est ouverte sans réseau. L’accès hors connexion aux données de votre
                  département n’est pas encore activé. Les nouvelles opérations nécessitent
                  actuellement le serveur.
                </p>
              )}
              {children}
              {footer}
            </main>
          </div>
          {user && menuOpen && <Drawer onClose={closeMenu}>{navigation(closeMenu)}</Drawer>}
          {user && !user.mustChangePassword && (
            <nav className="mobile-bottom-navigation" aria-label="Navigation rapide">
              <NavLink to="/tableau-de-bord" aria-label="Accueil" end>
                <Icon name="home" />
                <span>Accueil</span>
              </NavLink>
              <NavLink to="/membres" aria-label="Accéder aux membres" end>
                <Icon name="users" />
                <span>Membres</span>
              </NavLink>
              <NavLink to="/encaissements" aria-label="Accéder aux encaissements" end>
                <Icon name="wallet" />
                <span>Paiements</span>
              </NavLink>
              <button
                type="button"
                aria-label="Plus de rubriques"
                onClick={() => setMenuOpen(true)}
              >
                <Icon name="more" />
                <span>Plus</span>
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
