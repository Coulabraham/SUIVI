import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { InstallationPage } from './InstallationPage';
import { inspectLocalStorage, requestPersistentStorage, saveDeviceLabel } from './storage';
import { usePwaStore } from './client';
vi.mock('./storage', () => ({
  inspectLocalStorage: vi.fn(),
  requestPersistentStorage: vi.fn(),
  saveDeviceLabel: vi.fn(),
}));
beforeEach(() => {
  usePwaStore.setState({
    registered: false,
    installed: false,
    offlineReady: false,
    installAvailable: false,
    updateAvailable: false,
    error: '',
  });
  vi.mocked(inspectLocalStorage).mockResolvedValue({
    label: 'Téléphone de recette',
    persistent: false,
    usage: 1024,
    quota: 1024 * 1024,
  });
  vi.mocked(saveDeviceLabel).mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist: vi.fn() } });
});
it('enregistre le nom choisi dans le stockage et confirme seulement après la réussite', async () => {
  render(<InstallationPage />);
  const user = userEvent.setup();
  const field = await screen.findByLabelText('Nom de l’appareil');
  await user.clear(field);
  await user.type(field, 'Appareil responsable');
  await user.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));
  expect(saveDeviceLabel).toHaveBeenCalledWith('Appareil responsable');
  expect(await screen.findByRole('status')).toHaveTextContent('enregistré localement');
});
it('signale le refus de persistance et une erreur de stockage sans annoncer de réussite', async () => {
  vi.mocked(requestPersistentStorage).mockResolvedValue(false);
  render(<InstallationPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Demander la protection du stockage' }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('n’a pas accordé');
  vi.mocked(saveDeviceLabel).mockRejectedValue(new Error('Stockage plein pour ce test'));
  await user.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Stockage plein');
  expect(
    screen.queryByText('Le nom de l’appareil est enregistré localement.'),
  ).not.toBeInTheDocument();
});
