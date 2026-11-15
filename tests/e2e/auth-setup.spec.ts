import { expect, test } from '@playwright/test';

test('première ouverture, piège invisible et création du premier administrateur par interface', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const email = process.env.SUIVI_E2E_LOGIN;
  const password = process.env.SUIVI_E2E_PASSWORD;
  const database = process.env.SUIVI_TEST_E2E_DATABASE_URL;
  if (!email || !password || !database || !/^\/suivi_test_/.test(new URL(database).pathname))
    throw new Error('Base de recette éphémère obligatoire.');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Administrateur', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Responsable', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Administrateur', exact: true }).click();
  await page.getByLabel('Prénom', { exact: true }).fill('Recette');
  await page.getByLabel('Nom', { exact: true }).fill('Navigateur');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
  const trap = page.locator('input[name="website"]');
  await trap.fill('https://spam.example', { force: true });
  await page.getByRole('button', { name: 'Créer mon compte administrateur' }).click();
  await expect(page.getByRole('alert')).toContainText('formulaire n’est pas valide');
  await expect(
    page.getByRole('heading', { name: 'Espace administrateur', exact: true }),
  ).toBeVisible();
  await trap.fill('', { force: true });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('premier-administrateur.png'), fullPage: true });
  await page.getByRole('button', { name: 'Créer mon compte administrateur' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tableau de bord général', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.getByRole('button', { name: 'Administrateur', exact: true }).click();
  await expect(page.getByLabel('Adresse e-mail ou identifiant')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer mon compte administrateur' })).toHaveCount(
    0,
  );
});
