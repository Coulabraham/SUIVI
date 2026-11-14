import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, installApp, startPwa, usePwaStore } from './client';

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
