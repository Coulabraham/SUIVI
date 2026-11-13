import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from './NotificationsPage';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
vi.mock('../../services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Erreur de test'),
}));
let read = false;
const notice = {
  id: 'notice-1',
  departmentId: 'department-a',
  type: 'WARNING',
  title: 'Encaissement corrigé',
  message: 'Une correction justifiée a été enregistrée.',
  entityType: 'PaymentRevision',
  entityId: 'revision-1',
  createdAt: '2026-11-13T10:00:00Z',
  readAt: null,
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  read = false;
  useAuthStore.getState().accept({
    accessToken: 'test',
    user: {
      id: 'manager-a',
      login: 'test',
      firstName: 'Test',
      lastName: 'Responsable',
      role: 'MANAGER',
      departmentId: 'department-a',
      mustChangePassword: false,
      status: 'ACTIVE',
      version: 1,
    },
  });
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data:
        url === '/notifications/unread-count'
          ? { unread: read ? 0 : 1 }
          : {
              items: [{ ...notice, readAt: read ? '2026-11-13T10:10:00Z' : null }],
              total: 1,
              page: 1,
              pageSize: 20,
            },
    },
  }));
  vi.mocked(api.patch).mockImplementation(async () => {
    read = true;
    return { data: { data: { updated: 1 } } };
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  useAuthStore.getState().clear();
});
it('marque la notification puis affiche le compteur renvoyé par le serveur', async () => {
  mount();
  const user = userEvent.setup();
  expect(await screen.findByRole('heading', { name: 'Encaissement corrigé' })).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Marquer comme lue : Encaissement corrigé' }),
  );
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith('/notifications/notice-1/read', { read: true }),
  );
  expect(await screen.findByText('0 notification non lue')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Marquer comme lue/ })).not.toBeInTheDocument();
});
it('ne marque rien sans confirmation lors d’une lecture groupée', async () => {
  mount();
  const user = userEvent.setup();
  await screen.findByText('1 notification non lue');
  await user.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
  expect(api.patch).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('button', { name: 'Confirmer la lecture de toutes les notifications' }),
  );
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith('/notifications/read-all', { read: true }),
  );
});
it('affiche une erreur sans prétendre que la notification est lue', async () => {
  vi.mocked(api.patch).mockRejectedValue(new Error('Le serveur est indisponible.'));
  mount();
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: notice.title });
  await user.click(
    screen.getByRole('button', { name: 'Marquer comme lue : Encaissement corrigé' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur est indisponible.');
  expect(screen.getByText('1 notification non lue')).toBeInTheDocument();
});
