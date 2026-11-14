import { describe, expect, it } from 'vitest';
import { isPrivatePath, isShellNavigation } from './cache-policy';
describe('Cache du shell PWA', () => {
  it('autorise les routes de l’application sans transformer une API, un export ou une URL inconnue en HTML', () => {
    for (const path of ['/', '/membres', '/installation', '/connexion', '/audit'])
      expect(isShellNavigation(path)).toBe(true);
    for (const path of [
      '/api/v1/members',
      '/API/v1/health/live',
      '/auth/refresh',
      '/reports/export.pdf',
      '/exports/members.csv',
      '/inconnu',
    ])
      expect(isShellNavigation(path)).toBe(false);
    expect(isPrivatePath('/API/v1/payments')).toBe(true);
  });
});
