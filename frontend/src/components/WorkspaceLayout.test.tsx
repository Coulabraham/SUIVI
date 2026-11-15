import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { WorkspaceLayout } from './WorkspaceLayout';
import { useAuthStore } from '../stores/auth';

const unread = vi.hoisted(() => ({ data: 2 as number | undefined, isError: false }));
vi.mock('../features/notifications/useUnread', () => ({ useUnread: () => unread }));
function Location() {
  const location = useLocation();
  return <output>{location.pathname + location.search}</output>;
}
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WorkspaceLayout authScreen={false}>
          <Location />
        </WorkspaceLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const originals = ['showModal', 'close'].map((name) =>
  Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterAll(() =>
  ['showModal', 'close'].forEach((name, index) => {
    const original = originals[index];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }),
);
beforeEach(() => {
  unread.data = 2;
  unread.isError = false;
  useAuthStore.getState().accept({
    accessToken: 'fixture',
    user: {
      id: 'fixture',
      login: 'fixture',
      firstName: 'Awa',
      lastName: 'Kone',
      role: 'MANAGER',
      status: 'ACTIVE',
      departmentId: 'own',
      mustChangePassword: false,
      version: 1,
    },
  });
});
describe('Navigation responsive selon les droits', () => {
  it('signale un compteur indisponible sans le présenter comme zéro notification', () => {
    unread.data = undefined;
    unread.isError = true;
    mount();
    expect(screen.getByRole('link', { name: 'Notifications · Indisponibles' })).toBeInTheDocument();
  });
  it('garde les rubriques administrateur hors de la navigation responsable', () => {
    mount();
    expect(screen.queryByRole('link', { name: 'Départements' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Journal d’audit' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation rapide' })).toBeInTheDocument();
  });
  it('ouvre le menu et traite son annulation sans navigation parasite', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu de navigation' });
    expect(dialog).toHaveAttribute('open');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Réseau connecté' })).toHaveTextContent(
      'Réseau connecté',
    );
  });
  it('transmet une recherche réelle à la liste de membres', async () => {
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un membre' }), 'Awa Kone');
    await user.click(screen.getByRole('button', { name: 'Lancer la recherche' }));
    expect(screen.getByRole('status', { name: 'Réseau connecté' })).toHaveTextContent(
      'Réseau connecté',
    );
    expect(screen.getByText('/membres?q=Awa%20Kone')).toBeInTheDocument();
  });
});
