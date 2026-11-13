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
  api: { post: vi.fn() },
  deviceFor: () => '4aab1b71-1db3-4993-bb08-9646c271fb48',
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Erreur'),
}));
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
});

describe('Authentification accessible et erreurs explicites', () => {
  it('affiche le refus du serveur sans conserver les mots de passe', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Identifiants invalides.'));
    mount('/connexion');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Identifiant'), 'test.responsable');
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'secret-de-test');
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
    await user.type(screen.getByLabelText('Identifiant'), 'test.responsable');
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'secret-de-test');
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
    expect(await screen.findByRole('heading', { name: 'Connexion à SUIVI' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Mot de passe modifié.');
  });
});
