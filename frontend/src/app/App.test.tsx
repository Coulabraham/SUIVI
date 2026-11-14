import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useAuthStore } from '../stores/auth';
import { getLiveness, getReadiness } from '../features/system/api';

vi.mock('../features/system/api', () => ({ getLiveness: vi.fn(), getReadiness: vi.fn() }));
const response = {
  data: { service: 'SUIVI' as const, status: 'ok' as const, checkedAt: '2026-11-12T12:00:00.000Z' },
};

function renderPage(path = '/presentation') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clear();
  vi.mocked(getLiveness).mockResolvedValue(response);
  vi.mocked(getReadiness).mockResolvedValue(response);
});

describe('Socle de navigation', () => {
  it('affiche la disponibilité issue des services', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Bienvenue dans SUIVI' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Disponible')).toHaveLength(3));
  });

  it('ouvre le diagnostic et relance réellement les contrôles', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('link', { name: /Consulter le diagnostic/ }));
    expect(
      screen.getByRole('heading', { name: 'Diagnostic de l’installation' }),
    ).toBeInTheDocument();
    const button = await screen.findByRole('button', { name: 'Vérifier les services' });
    const count = vi.mocked(getReadiness).mock.calls.length;
    await user.click(button);
    await waitFor(() => expect(vi.mocked(getReadiness).mock.calls.length).toBeGreaterThan(count));
  });

  it('affiche une erreur explicite de base indisponible', async () => {
    vi.mocked(getReadiness).mockRejectedValue(new Error('PostgreSQL indisponible pour ce test.'));
    renderPage('/diagnostic');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'PostgreSQL indisponible pour ce test.',
    );
  });

  it('permet de revenir d’une route inconnue', () => {
    renderPage('/page-absente');
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revenir à l’accueil' })).toHaveAttribute('href', '/');
  });
});
it('ouvre le choix de connexion au premier accès', () => {
  renderPage('/');
  expect(screen.getByRole('button', { name: 'Administrateur' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Responsable' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
