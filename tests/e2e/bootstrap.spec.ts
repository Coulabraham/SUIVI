import { expect, test } from '@playwright/test';

test('navigation, API et PostgreSQL réels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenue dans SUIVI' })).toBeVisible();
  await expect(page.getByText('Disponible', { exact: true })).toHaveCount(3);
  await page.getByRole('link', { name: /Consulter le diagnostic/ }).click();
  await expect(page.getByRole('heading', { name: 'Diagnostic de l’installation' })).toBeVisible();
  await expect(page.getByText('Opérationnel', { exact: true })).toHaveCount(2);
  const retry = page.getByRole('button', { name: 'Vérifier les services' });
  await retry.click();
  await expect(retry).toBeEnabled();
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
});

test('route inconnue et retour à l’accueil', async ({ page }) => {
  await page.goto('/route-inconnue');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans SUIVI' })).toBeVisible();
});
