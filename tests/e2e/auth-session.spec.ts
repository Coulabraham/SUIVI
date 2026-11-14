import { expect, test, type Page } from '@playwright/test';

test('une connexion sur un autre appareil ferme la première session', async ({ page, browser }) => {
  test.setTimeout(60000);
  const login = process.env.SUIVI_E2E_LOGIN;
  const password = process.env.SUIVI_E2E_PASSWORD;
  if (!login || !password) throw new Error('Accès de recette obligatoires.');
  const signIn = async (target: Page) => {
    await target.goto('http://127.0.0.1:4174/connexion');
    await target.getByRole('button', { name: 'Administrateur', exact: true }).click();
    await target.getByLabel('Adresse e-mail ou identifiant').fill(login);
    await target.getByLabel('Mot de passe', { exact: true }).fill(password);
    const response = target.waitForResponse(
      (value) => value.url().endsWith('/api/v1/auth/login') && value.request().method() === 'POST',
    );
    await target.getByRole('button', { name: 'Se connecter', exact: true }).click();
    const token = (await (await response).json()).data.accessToken as string;
    await expect(
      target.getByRole('heading', { name: 'Vue d’ensemble', exact: true }),
    ).toBeVisible();
    return token;
  };
  const firstToken = await signIn(page);
  const secondDevice = await browser.newContext();
  try {
    const other = await secondDevice.newPage();
    await signIn(other);
    const rejected = await page.request.get('/api/v1/auth/profile', {
      headers: { Authorization: 'Bearer ' + firstToken },
    });
    expect(rejected.status()).toBe(401);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Administrateur', exact: true })).toBeVisible();
    await expect(other.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
    await other.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  } finally {
    await secondDevice.close();
  }
});
