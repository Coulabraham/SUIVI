import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, installApp, observeUpdates, startPwa, usePwaStore } from './client';

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
  await startPwa();
});
beforeEach(() =>
  usePwaStore.setState({ installAvailable: false, error: '', updateAvailable: false }),
);
describe('Installation et mise à jour explicites', () => {
  it('repère un worker déjà en attente sans attendre un nouvel événement du SDK', () => {
    const registration = Object.assign(new EventTarget(), { waiting: {}, installing: null });
    observeUpdates(registration as unknown as ServiceWorkerRegistration, () => true);
    expect(usePwaStore.getState().updateAvailable).toBe(true);
  });
  it('annonce une nouvelle installation seulement si une version contrôle déjà la page', () => {
    const worker = Object.assign(new EventTarget(), { state: 'installing' });
    const registration = Object.assign(new EventTarget(), { waiting: null, installing: worker });
    let controlled = false;
    observeUpdates(registration as unknown as ServiceWorkerRegistration, () => controlled);
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(usePwaStore.getState().updateAvailable).toBe(false);
    controlled = true;
    worker.state = 'installing';
    registration.dispatchEvent(new Event('updatefound'));
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(usePwaStore.getState().updateAvailable).toBe(true);
  });
  it('consomme la proposition d’installation une seule fois, y compris après un refus', async () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(usePwaStore.getState().installAvailable).toBe(true);
    await installApp();
    await installApp();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().installAvailable).toBe(false);
  });
  it('rend visible l’échec d’installation et ne prétend pas que l’application est installée', async () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockRejectedValue(new Error('Refus simulé')),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
    await installApp();
    expect(usePwaStore.getState().error).toContain('n’a pas abouti');
    expect(usePwaStore.getState().installed).toBe(false);
  });
  it('refuse une mise à jour lorsqu’un formulaire est ouvert', async () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    try {
      await expect(applyUpdate()).rejects.toThrow('formulaire ouvert');
    } finally {
      dialog.remove();
    }
  });
});
