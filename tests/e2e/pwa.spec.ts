import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';

// Origine isolée pour simuler deux versions du worker sans remplacer le build
// servi aux parcours métier. Aucun endpoint de test n'est ajouté à l'application.
const origin = 'http://127.0.0.1:4175';
let server: Server;
let revised = false;
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    try {
      const target = new URL(request.url ?? '/', 'http://127.0.0.1:4174');
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (
          value &&
          ![
            'host',
            'connection',
            'content-length',
            'transfer-encoding',
            'accept-encoding',
          ].includes(name)
        )
          headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const chunks: Buffer[] = [];
      for await (const part of request)
        chunks.push(Buffer.isBuffer(part) ? part : Buffer.from(String(part)));
      const method = request.method ?? 'GET';
      const upstream = await fetch(target, {
        method,
        headers,
        ...(method === 'GET' || method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
        signal: AbortSignal.timeout(30000),
      });
      let content = Buffer.from(await upstream.arrayBuffer());
      if (target.pathname === '/sw.js' && revised)
        content = Buffer.concat([
          content,
          Buffer.from('\n// Version suivante pour la recette PWA.\n'),
        ]);
      response.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/',
      });
      response.end(content);
    } catch {
      response.writeHead(502);
      response.end('Serveur de recette indisponible.');
    }
  });
  await new Promise<void>((yes, no) => {
    server.once('error', no);
    server.listen(4175, '127.0.0.1', yes);
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});
test.beforeEach(() => {
  revised = false;
});

test('manifest installable et icônes PNG de dimensions correctes', async ({ page, request }) => {
  await page.goto(origin + '/installation');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestResponse = await request.get(new URL(href!, origin).href);
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as {
    id: string;
    scope: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/', display: 'standalone' });
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const asset = await request.get(new URL(icon.src, origin).href);
    const png = await asset.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16) + 'x' + png.readUInt32BE(20)).toBe(icon.sizes);
  }
});

test('réouverture hors réseau, navigation et IndexedDB sans cache des réponses API privées', async ({
  page,
  context,
}, info) => {
  await page.goto(origin + '/installation');
  await expect(
    page.getByText('Fichiers de l’application disponibles sur cet appareil', { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const field = page.getByLabel('Nom de l’appareil');
  await field.fill('Téléphone PWA de recette');
  await page.getByRole('button', { name: 'Enregistrer le nom' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'nom de l’appareil est enregistré' }),
  ).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/v1/health/live')).status)).toBe(200);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Installer SUIVI', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nom de l’appareil')).toHaveValue('Téléphone PWA de recette');
  expect(await page.evaluate(async () => (await fetch('/manifest.webmanifest')).status)).toBe(200);
  await expect(
    page.getByText('L’application est ouverte sans réseau.', { exact: false }),
  ).toBeVisible();
  const apiResult = await page.evaluate(async () => {
    try {
      return 'HTTP_' + (await fetch('/api/v1/health/live')).status;
    } catch {
      return 'NETWORK_ERROR';
    }
  });
  expect(apiResult).toBe('NETWORK_ERROR');
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        urls.push(new URL(request.url).pathname);
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(5);
  expect(cachedUrls.filter((path) => /^\/(api|auth|reports|exports)(\/|$)/i.test(path))).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('pwa-offline.png'), fullPage: true });
  await page.getByRole('link', { name: 'Connexion', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Bienvenue dans SUIVI', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Responsable', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeDisabled();
});

test('mise à jour proposée sans rechargement automatique, saisie préservée puis rechargement confirmé', async ({
  page,
}) => {
  // Deux onglets et deux versions du worker, avec des attentes locales de 20 s.
  // Le budget global doit laisser exécuter les assertions après le rechargement.
  test.setTimeout(90000);
  await page.goto(origin + '/installation');
  await expect(
    page.getByText('Fichiers de l’application disponibles sur cet appareil', { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByLabel('Nom de l’appareil').fill('Saisie à conserver');
  // La recette mobile qualifie la fenêtre PWA ; les onglets simultanés sont
  // exercés sur desktop. Leur émulation mobile reste explicitement non qualifiée.
  const otherTab =
    test.info().project.name === 'chrome-desktop' ? await page.context().newPage() : null;
  if (otherTab) {
    await otherTab.goto(origin + '/installation');
    await otherTab.getByLabel('Nom de l’appareil').fill('Saisie non enregistree autre onglet');
    await page.bringToFront();
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  }
  revised = true;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect
    .poll(
      () => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
      { timeout: 20000 },
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Mettre à jour SUIVI', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel('Nom de l’appareil')).toHaveValue('Saisie à conserver');
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Mettre à jour SUIVI', exact: true }).click();
  await page.getByRole('button', { name: 'Plus tard', exact: true }).click();
  await expect(page.getByLabel('Nom de l’appareil')).toHaveValue('Saisie à conserver');
  await page.getByRole('button', { name: 'Enregistrer le nom' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'nom de l’appareil est enregistré' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mettre à jour SUIVI', exact: true }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Recharger et appliquer', exact: true }).click();
  await reloaded;
  await expect(page.getByLabel('Nom de l’appareil')).toHaveValue('Saisie à conserver');
  await expect(page.getByRole('button', { name: 'Mettre à jour SUIVI', exact: true })).toHaveCount(
    0,
  );
  if (otherTab) {
    await expect(otherTab.getByLabel('Nom de l’appareil')).toHaveValue(
      'Saisie non enregistree autre onglet',
    );
    await otherTab.close();
  }
});
