import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { UserProfile } from '@suivi/contracts';
import { LoginPage, ProfilePage } from './AuthPages';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: { post: vi.fn(), get: vi.fn() },
  deviceFor: () => '4aab1b71-1db3-4993-bb08-9646c271fb48',
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Erreur'),
}));
vi.mock('../../pwa/storage', () => ({ readDeviceLabel: async () => 'Navigateur de test' }));
const profile: UserProfile = {
  id: 'f6aaf8ea-8cd0-4522-9725-8191ae456ca6',
  login: 'test.responsable',
  firstName: 'Test',
  lastName: 'Responsable',
  role: 'MANAGER',
  departmentId: '4dd07e5e-31d9-4fb6-809c-bd4647091e39',
  mustChangePassword: true,
  status: 'ACTIVE',
  version: 1,
};
function mount(path: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/tableau-de-bord" element={<h1>Tableau de bord du test</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clear();
  localStorage.clear();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { registrationOpen: false } } });
});

describe('Authentification accessible et erreurs explicites', () => {
  it('affiche puis masque le secret sans soumettre le formulaire', async () => {
    mount('/connexion?espace=responsable');
    const user = userEvent.setup();
    const input = screen.getByLabelText('Code de connexion');
    await user.type(input, 'secret-de-recette');
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret-de-recette');
    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(input).toHaveAttribute('type', 'password');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('mémorise uniquement l’identifiant sur demande et permet de le retirer', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Accès de recette refusé.'));
    const view = mount('/connexion?espace=responsable');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Identifiant'), 'responsable.recette');
    await user.type(screen.getByLabelText('Code de connexion'), 'secret-non-stocke');
    await user.click(screen.getByLabelText('Mémoriser mon identifiant'));
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByRole('alert');
    expect(localStorage.getItem('suivi.remembered-login.MANAGER')).toBe('responsable.recette');
    expect(JSON.stringify({ ...localStorage })).not.toContain('secret-non-stocke');
    view.unmount();
    mount('/connexion?espace=responsable');
    expect(screen.getByLabelText('Identifiant')).toHaveValue('responsable.recette');
    await user.type(screen.getByLabelText('Code de connexion'), 'secret-non-stocke');
    await user.click(screen.getByLabelText('Mémoriser mon identifiant'));
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByRole('alert');
    expect(localStorage.getItem('suivi.remembered-login.MANAGER')).toBeNull();
  });
  it('affiche le refus du serveur sans conserver les mots de passe', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Identifiants invalides.'));
    mount('/connexion');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Responsable' }));
    await user.type(screen.getByLabelText('Identifiant'), 'test.responsable');
    await user.type(screen.getByLabelText('Code de connexion', { exact: true }), 'secret-de-test');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides.');
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.length).toBe(0);
  });
  it('redirige une première connexion vers le changement obligatoire', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { accessToken: 'test-token', user: profile } },
    });
    mount('/connexion');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Responsable' }));
    await user.type(screen.getByLabelText('Identifiant'), 'test.responsable');
    await user.type(screen.getByLabelText('Code de connexion', { exact: true }), 'secret-de-test');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(
      await screen.findByRole('heading', { name: 'Choisir votre mot de passe' }),
    ).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });
  it('refuse une confirmation différente avant toute requête de changement', async () => {
    useAuthStore.getState().accept({ accessToken: 'test-token', user: profile });
    mount('/profil');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'initial-secret');
    await user.type(
      screen.getByLabelText('Nouveau mot de passe', { exact: true }),
      'nouvelle-phrase-longue',
    );
    await user.type(
      screen.getByLabelText('Confirmer le nouveau mot de passe'),
      'phrase-differente',
    );
    await user.click(
      screen.getByRole('button', { name: 'Changer le mot de passe et me reconnecter' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les mots de passe ne correspondent pas.',
    );
    expect(api.post).not.toHaveBeenCalled();
  });
  it('efface la session après changement confirmé et demande une nouvelle connexion', async () => {
    useAuthStore.getState().accept({ accessToken: 'test-token', user: profile });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { changed: true } } });
    mount('/profil');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'initial-secret');
    await user.type(
      screen.getByLabelText('Nouveau mot de passe', { exact: true }),
      'nouvelle-phrase-longue',
    );
    await user.type(
      screen.getByLabelText('Confirmer le nouveau mot de passe'),
      'nouvelle-phrase-longue',
    );
    await user.click(
      screen.getByRole('button', { name: 'Changer le mot de passe et me reconnecter' }),
    );
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(
      await screen.findByRole('heading', { name: 'Bienvenue dans SUIVI' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.');
  });
  it('présente les deux espaces et efface le secret lors du changement de choix', async () => {
    mount('/connexion');
    const user = userEvent.setup();
    expect(screen.queryByLabelText('Identifiant')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Responsable' }));
    await user.type(screen.getByLabelText('Code de connexion'), 'code-prive');
    await user.click(screen.getByRole('button', { name: /Changer d’espace/ }));
    await user.click(screen.getByRole('button', { name: 'Responsable' }));
    expect(screen.getByLabelText('Code de connexion')).toHaveValue('');
  });
  it('invalide un piège rempli avant de transmettre les accès', async () => {
    mount('/connexion?espace=responsable');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Identifiant'), 'test.responsable');
    await user.type(screen.getByLabelText('Code de connexion'), 'code-prive');
    const trap = screen.getByLabelText('Site internet — laisser vide');
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('textbox', { name: /Site internet/ })).toBeNull();
    await user.type(trap, 'spam');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('formulaire n’est pas valide');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('connecte un administrateur existant dans le bon espace', async () => {
    const admin = {
      ...profile,
      role: 'SUPER_ADMIN' as const,
      mustChangePassword: false,
      departmentId: null,
    };
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { accessToken: 'test-admin', user: admin } },
    });
    mount('/connexion?espace=admin');
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Adresse e-mail ou identifiant'),
      'admin@example.test',
    );
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'phrase-privee');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(
      await screen.findByRole('heading', { name: 'Tableau de bord du test' }),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({ portal: 'SUPER_ADMIN', website: '' }),
    );
  });
  it('crée le premier administrateur par API avec son e-mail et ses noms sans envoyer la confirmation', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { registrationOpen: true } } });
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          accessToken: 'test-admin',
          user: { ...profile, role: 'SUPER_ADMIN', departmentId: null, mustChangePassword: false },
        },
      },
    });
    mount('/connexion?espace=admin');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Prénom'), 'Awa');
    await user.type(screen.getByLabelText('Nom', { exact: true }), 'Kone');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'une-longue-phrase');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'une-longue-phrase');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte administrateur' }));
    expect(
      await screen.findByRole('heading', { name: 'Tableau de bord du test' }),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register-admin', {
      email: 'awa@example.test',
      firstName: 'Awa',
      lastName: 'Kone',
      password: 'une-longue-phrase',
      website: '',
      deviceId: expect.any(String),
      deviceLabel: 'Navigateur de test',
    });
    expect(localStorage.length).toBe(0);
  });
  it('rejette une confirmation différente à l’inscription', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { registrationOpen: true } } });
    mount('/connexion?espace=admin');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Prénom'), 'Awa');
    await user.type(screen.getByLabelText('Nom', { exact: true }), 'Kone');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'une-longue-phrase');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'autre-phrase');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte administrateur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ne correspondent pas');
    expect(api.post).not.toHaveBeenCalled();
  });
});
