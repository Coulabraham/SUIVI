import { expect, test } from '@playwright/test';

test('navigation, API et PostgreSQL réels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenue dans SUIVI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Administrateur', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('choix-connexion.png'), fullPage: true });
  if (test.info().project.name === 'chrome-mobile')
    await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Responsable', exact: true }).click();
  await expect(page.getByLabel('Code de connexion')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath('connexion-responsable.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: /Besoin d’aide/ }).click();
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
