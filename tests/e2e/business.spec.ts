import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const adminLogin = process.env.SUIVI_E2E_LOGIN;
const password = process.env.SUIVI_E2E_PASSWORD;
const database = process.env.SUIVI_TEST_E2E_DATABASE_URL;
if (!adminLogin || !password || !database || !/^\/suivi_test_/.test(new URL(database).pathname))
  throw new Error('Exécuter npm.cmd run test:e2e : base éphémère et accès de test obligatoires.');
const signIn = async (page: Page, login: string, secret: string) => {
  await page.goto('/connexion');
  await page.getByLabel('Identifiant', { exact: true }).fill(login);
  await page.getByLabel('Mot de passe', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
};

// Chaque projet commence sans campagne courante, même après un parcours précédent échoué.
// Cette préparation utilise uniquement l'API et la base éphémère contrôlée ci-dessus.
test.beforeEach(async ({ request }) => {
  const headers = { 'X-SUIVI-CLIENT': 'web' };
  const loginResponse = await request.post('http://127.0.0.1:3101/api/v1/auth/login', {
    headers,
    data: {
      login: adminLogin,
      password,
      deviceId: randomUUID(),
      deviceLabel: 'Préparation de recette isolée',
    },
  });
  expect(loginResponse.status()).toBe(200);
  const access = (await loginResponse.json()).data.accessToken as string;
  const authorization = { ...headers, Authorization: 'Bearer ' + access };
  const campaigns = await request.get('http://127.0.0.1:3101/api/v1/objectives?pageSize=100', {
    headers: authorization,
  });
  expect(campaigns.status()).toBe(200);
  for (const row of (await campaigns.json()).data.items as {
    id: string;
    version: number;
    status: string;
  }[]) {
    if (row.status === 'ACTIVE' || row.status === 'SUSPENDED') {
      const closed = await request.patch('http://127.0.0.1:3101/api/v1/objectives/' + row.id, {
        headers: authorization,
        data: {
          version: row.version,
          status: 'CLOSED',
          reason: 'Préparation du parcours navigateur suivant',
        },
      });
      expect(closed.status()).toBe(200);
    }
  }
  expect(
    (
      await request.post('http://127.0.0.1:3101/api/v1/auth/logout', { headers: authorization })
    ).status(),
  ).toBe(200);
});

test('parcours complet Super Administrateur et Responsable avec données PostgreSQL réelles', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const suffix = info.project.name + '-' + randomUUID().slice(0, 8);
  const department = 'Recette ' + suffix;
  const login = 'recette.' + suffix;
  const member = 'Membre ' + suffix;
  const campaign = 'Campagne ' + suffix;
  const deviceLabel = 'Appareil de recette ' + suffix;
  await signIn(page, adminLogin, password);
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Installer SUIVI', exact: true }).click();
  await page.getByLabel('Nom de l’appareil').fill(deviceLabel);
  await page.getByRole('button', { name: 'Enregistrer le nom', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'nom de l’appareil est enregistré' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Départements', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un département' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Nom/).fill(department);
  await dialog.getByLabel(/^Statut/).selectOption('ACTIVE');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('cell', { name: department, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Responsables', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un responsable' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Identifiant unique/).fill(login);
  await dialog.getByLabel(/^Prénom/).fill('Responsable');
  await dialog.getByLabel(/^Nom/).fill(suffix);
  await dialog.getByLabel(/^Département/).selectOption({ label: department });
  await dialog.getByLabel(/^Statut/).selectOption('ACTIVE');
  await dialog.getByLabel(/^Validité/).fill('24');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Accès initial — affichage unique' }),
  ).toBeVisible();
  const initialPassword = await page.getByRole('dialog').locator('dd').nth(1).innerText();
  await page.getByRole('button', { name: 'J’ai remis les accès, fermer' }).click();

  await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
  await page.getByRole('button', { name: 'Créer une campagne', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Nom de la campagne/).fill(campaign);
  await dialog.getByLabel(/^Objectif global entier/).fill('10000');
  await dialog.getByLabel(/^Date de début/).fill(new Date().toISOString().slice(0, 10));
  await dialog
    .getByLabel(/^Date de fin/)
    .fill(new Date(Date.now() + 364 * 86400000).toISOString().slice(0, 10));
  await dialog.getByLabel(/^Fuseau IANA/).fill('UTC');
  await dialog.getByLabel(/^Convention/).selectOption('SUNDAY_SATURDAY');
  await dialog.getByLabel(/^Statut initial/).selectOption('ACTIVE');
  // La génération transactionnelle du calendrier peut dépasser les cinq secondes
  // d'une assertion UI ; attendre sa réponse, puis vérifier aussi le rendu.
  const campaignResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/objectives' &&
      response.request().method() === 'POST',
    { timeout: 35000 },
  );
  await dialog.getByRole('button', { name: 'Créer la campagne et ses semaines' }).click();
  expect((await campaignResponse).status()).toBe(201);
  await expect(page.getByRole('heading', { name: campaign, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();

  await signIn(page, login, initialPassword);
  await expect(page.getByRole('heading', { name: 'Choisir votre mot de passe' })).toBeVisible();
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill(initialPassword);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Changer le mot de passe et me reconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à SUIVI' })).toBeVisible();
  await signIn(page, login, password);
  await expect(page.getByRole('heading', { name: 'Mon département', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Départements', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mon département', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Journal d’audit', exact: true })).toHaveCount(0);
  await page.goto('/audit');
  await expect(page.getByRole('alert')).toContainText(
    'Cette page est réservée au Super Administrateur.',
  );
  await page.getByRole('link', { name: /^Notifications/ }).click();
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mot de passe modifié', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tout marquer comme lu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirmer la lecture de toutes les notifications' })
    .click();
  await expect(page.getByText('0 notification non lue', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Membres', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un membre' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Numéro de membre/).fill('NUM-' + suffix);
  await dialog.getByLabel(/^Prénom/).fill('Membre');
  await dialog.getByLabel(/^Nom/).fill(suffix);
  await dialog.getByLabel(/^Contact/).fill('Contact de recette');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('cell', { name: new RegExp('Membre ' + suffix) })).toBeVisible();
  await page.getByRole('link', { name: 'Encaissements', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer un encaissement' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Membre \*/).selectOption({ label: 'NUM-' + suffix + ' · ' + member });
  await dialog.getByLabel(/^Montant entier/).fill('12000');
  await dialog.getByLabel(/^Semaine de collecte/).selectOption({ index: 1 });
  await dialog.getByLabel(/^Mode de paiement/).fill('TEST_CASH');
  await dialog.getByRole('button', { name: 'Vérifier avant enregistrement' }).click();
  await page.getByRole('button', { name: /Confirmer et enregistrer/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Encaissement validé par le serveur.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  await expect(page.getByText('120,00 %', { exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: info.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();

  await signIn(page, adminLogin, password);
  await page.getByRole('link', { name: 'Encaissements', exact: true }).click();
  const paymentRow = page.getByRole('row').filter({ hasText: member });
  await paymentRow.getByRole('button', { name: 'Corriger', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Montant corrigé/).fill('9000');
  await dialog.getByLabel(/^Justification/).fill('Montant vérifié sur le reçu de recette');
  await dialog.getByRole('button', { name: 'Confirmer la correction' }).click();
  await expect(paymentRow).toContainText('9\u202f000 FCFA');
  await paymentRow.getByRole('button', { name: 'Annuler', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Justification/).fill('Annulation de la transaction de recette');
  await dialog.getByRole('button', { name: 'Confirmer l’annulation' }).click();
  await expect(paymentRow).toContainText('Annulé');
  await paymentRow.getByRole('button', { name: 'Détails' }).click();
  await expect(page.getByRole('dialog')).toContainText('Montant vérifié sur le reçu de recette');
  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();

  await page.getByRole('link', { name: /^Notifications/ }).click();
  await page.getByRole('searchbox', { name: 'Rechercher' }).fill('Encaissement annulé');
  const notice = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Encaissement annulé', exact: true }) })
    .first();
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: /Marquer comme lue/ }).click();
  await expect(notice).toContainText('Avertissement · Lue');
  await page.screenshot({ path: info.outputPath('notifications.png'), fullPage: true });
  await page.getByRole('link', { name: 'Journal d’audit', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Action', exact: true })
    .selectOption('PAYMENT_CORRECTED');
  await page
    .getByRole('combobox', { name: 'Département', exact: true })
    .selectOption({ label: department });
  await page
    .getByRole('row')
    .filter({ hasText: 'Encaissement corrigé' })
    .getByRole('button', { name: 'Consulter', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('12000');
  await expect(page.getByRole('dialog')).toContainText('9000');
  await expect(page.getByRole('dialog')).toContainText(deviceLabel);
  await expect(page.getByRole('dialog')).toContainText('Montant vérifié sur le reçu de recette');
  const auditWidth = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(auditWidth.content).toBeLessThanOrEqual(auditWidth.viewport);
  await page.screenshot({ path: info.outputPath('audit.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();

  await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
  await page
    .getByRole('article')
    .filter({ hasText: campaign })
    .getByRole('button', { name: 'Modifier / clôturer' })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Statut/).selectOption('CLOSED');
  await dialog.getByLabel(/^Justification/).fill('Fin du parcours de recette navigateur');
  await dialog.getByRole('button', { name: 'Confirmer les modifications' }).click();
  await expect(page.getByRole('article').filter({ hasText: campaign })).toContainText('Clôturée');
});
