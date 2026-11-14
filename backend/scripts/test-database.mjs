import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browserOnly = process.argv.includes('--e2e-only');
const withBrowser = browserOnly || process.argv.includes('--e2e');
const browserArgumentStart = process.argv.indexOf('--');
const browserArguments =
  browserArgumentStart === -1 ? [] : process.argv.slice(browserArgumentStart + 1);
let cluster;
let bin;
let started = false;
let urls;
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: backend,
    windowsHide: true,
    timeout: 180000,
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Échec de ${args[0] ?? command} (code ${result.status}). ${result.stderr ?? ''}`,
    );
  return result;
};

async function freePort() {
  const server = createServer();
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port de test indisponible.');
  await new Promise((yes, no) => server.close((error) => (error ? no(error) : yes())));
  return address.port;
}

async function requireEmptyTestDatabase(migrationUrl, appUrl) {
  const migration = new URL(migrationUrl);
  const app = new URL(appUrl);
  if (
    !/^\/suivi_test_[a-z0-9_]+$/.test(migration.pathname) ||
    migration.pathname !== app.pathname ||
    migration.host !== app.host ||
    migration.username !== 'suivi_migrator' ||
    app.username !== 'suivi_app'
  ) {
    throw new Error('Paire de connexions de test invalide : base dédiée et rôles séparés requis.');
  }
  const owner = new pg.Client({ connectionString: migrationUrl });
  await owner.connect();
  try {
    const result = await owner.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
    );
    if (result.rows[0].count !== 0)
      throw new Error('La base dédiée doit être vide ; aucun nettoyage destructif automatique.');
  } finally {
    await owner.end();
  }
}

try {
  if (process.env.SUIVI_TEST_MIGRATION_URL && process.env.SUIVI_TEST_DATABASE_URL) {
    if (
      !process.env.SUIVI_TEST_DEMO_MIGRATION_URL ||
      !process.env.SUIVI_TEST_DEMO_DATABASE_URL ||
      !process.env.SUIVI_TEST_API_MIGRATION_URL ||
      !process.env.SUIVI_TEST_API_DATABASE_URL ||
      !process.env.SUIVI_TEST_EVENTS_MIGRATION_URL ||
      !process.env.SUIVI_TEST_EVENTS_DATABASE_URL
    )
      throw new Error('Fournir aussi les paires URL des bases demo, API et événements dédiées.');
    urls = {
      migration: process.env.SUIVI_TEST_MIGRATION_URL,
      app: process.env.SUIVI_TEST_DATABASE_URL,
      demoMigration: process.env.SUIVI_TEST_DEMO_MIGRATION_URL,
      demoApp: process.env.SUIVI_TEST_DEMO_DATABASE_URL,
      apiMigration: process.env.SUIVI_TEST_API_MIGRATION_URL,
      apiApp: process.env.SUIVI_TEST_API_DATABASE_URL,
      eventsMigration: process.env.SUIVI_TEST_EVENTS_MIGRATION_URL,
      eventsApp: process.env.SUIVI_TEST_EVENTS_DATABASE_URL,
      ...(withBrowser
        ? {
            e2eMigration: process.env.SUIVI_TEST_E2E_MIGRATION_URL,
            e2eApp: process.env.SUIVI_TEST_E2E_DATABASE_URL,
          }
        : {}),
    };
  } else {
    if (process.platform !== 'win32' || !process.env.LOCALAPPDATA)
      throw new Error(
        'Fournir SUIVI_TEST_MIGRATION_URL et SUIVI_TEST_DATABASE_URL pour une base PostgreSQL de test vide dédiée.',
      );
    bin = join(process.env.LOCALAPPDATA, 'SUIVI', 'postgresql-18.7-1', 'pgsql', 'bin');
    if (!existsSync(join(bin, 'initdb.exe')))
      throw new Error('Installer les binaires via npm run db:local:start.');
    cluster = await mkdtemp(join(tmpdir(), 'suivi-db-test-'));
    const data = join(cluster, 'data');
    const secretFile = join(cluster, 'password');
    const password = randomBytes(32).toString('base64url');
    const port = await freePort();
    await mkdir(cluster, { recursive: true });
    await writeFile(secretFile, password, { mode: 0o600, flag: 'wx' });
    try {
      run(join(bin, 'initdb.exe'), [
        '-D',
        data,
        '-U',
        'suivi_test_bootstrap',
        '--pwfile',
        secretFile,
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ]);
    } finally {
      await unlink(secretFile);
    }
    run(
      join(bin, 'pg_ctl.exe'),
      [
        '-D',
        data,
        '-l',
        join(cluster, 'postgres.log'),
        '-o',
        `-h 127.0.0.1 -p ${port} -c timezone=UTC`,
        '-w',
        '-t',
        '30',
        'start',
      ],
      { stdio: 'ignore' },
    );
    started = true;
    const admin = new pg.Client({
      host: '127.0.0.1',
      port,
      database: 'postgres',
      user: 'suivi_test_bootstrap',
      password,
    });
    const appPassword = randomBytes(32).toString('base64url');
    const migrationPassword = randomBytes(32).toString('base64url');
    const database = `suivi_test_${randomBytes(6).toString('hex')}`;
    await admin.connect();
    try {
      await admin.query(
        `CREATE ROLE suivi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${appPassword}'`,
      );
      await admin.query(
        `CREATE ROLE suivi_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${migrationPassword}'`,
      );
      await admin.query(`CREATE DATABASE ${database} OWNER suivi_migrator`);
      await admin.query(`CREATE DATABASE ${database}_demo OWNER suivi_migrator`);
      await admin.query(`CREATE DATABASE ${database}_api OWNER suivi_migrator`);
      await admin.query(`CREATE DATABASE ${database}_events OWNER suivi_migrator`);
      if (withBrowser) await admin.query(`CREATE DATABASE ${database}_e2e OWNER suivi_migrator`);
    } finally {
      await admin.end();
    }
    urls = {
      migration: `postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:${port}/${database}`,
      app: `postgresql://suivi_app:${appPassword}@127.0.0.1:${port}/${database}`,
      demoMigration: `postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:${port}/${database}_demo`,
      demoApp: `postgresql://suivi_app:${appPassword}@127.0.0.1:${port}/${database}_demo`,
      apiMigration: `postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:${port}/${database}_api`,
      apiApp: `postgresql://suivi_app:${appPassword}@127.0.0.1:${port}/${database}_api`,
      eventsMigration: `postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:${port}/${database}_events`,
      eventsApp: `postgresql://suivi_app:${appPassword}@127.0.0.1:${port}/${database}_events`,
      ...(withBrowser
        ? {
            e2eMigration: `postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:${port}/${database}_e2e`,
            e2eApp: `postgresql://suivi_app:${appPassword}@127.0.0.1:${port}/${database}_e2e`,
          }
        : {}),
    };
    console.log(
      'Instance PostgreSQL temporaire créée ; aucune connexion aux données de développement.',
    );
  }
  await requireEmptyTestDatabase(urls.migration, urls.app);
  await requireEmptyTestDatabase(urls.demoMigration, urls.demoApp);
  await requireEmptyTestDatabase(urls.apiMigration, urls.apiApp);
  await requireEmptyTestDatabase(urls.eventsMigration, urls.eventsApp);
  if (withBrowser) {
    if (!urls.e2eMigration || !urls.e2eApp)
      throw new Error('Les deux URL dédiées E2E sont requises.');
    await requireEmptyTestDatabase(urls.e2eMigration, urls.e2eApp);
  }
  if (
    new Set(
      [
        urls.migration,
        urls.demoMigration,
        urls.apiMigration,
        urls.eventsMigration,
        ...(withBrowser ? [urls.e2eMigration] : []),
      ].map((value) => {
        const u = new URL(value);
        return u.host + u.pathname;
      }),
    ).size !== (withBrowser ? 5 : 4)
  )
    throw new Error('Quatre bases de test distinctes sont nécessaires, cinq avec le navigateur.');
  if (
    new URL(urls.migration).pathname === new URL(urls.demoMigration).pathname &&
    new URL(urls.migration).host === new URL(urls.demoMigration).host
  ) {
    throw new Error('Les deux bases de test doivent être distinctes.');
  }
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: urls.app,
    DIRECT_DATABASE_URL: urls.migration,
    SUIVI_TEST_DATABASE_URL: urls.app,
    SUIVI_TEST_MIGRATION_URL: urls.migration,
  };
  const prisma = join(backend, '../node_modules/prisma/build/index.js');
  if (!browserOnly) {
    run(process.execPath, [prisma, 'migrate', 'deploy'], { env, stdio: 'inherit' });
    if (!/^\/suivi_test_[a-z0-9_]+$/.test(new URL(urls.demoMigration).pathname))
      throw new Error('Cible de démonstration de test invalide.');
    run(process.execPath, [prisma, 'migrate', 'deploy'], {
      env: { ...env, DIRECT_DATABASE_URL: urls.demoMigration },
      stdio: 'inherit',
    });
    run(process.execPath, [prisma, 'migrate', 'deploy'], {
      env: { ...env, DIRECT_DATABASE_URL: urls.eventsMigration },
      stdio: 'inherit',
    });
    // Le second déploiement doit être sans mutation et confirmer l'historique versionné.
    run(process.execPath, [prisma, 'migrate', 'deploy'], {
      env: { ...env, DIRECT_DATABASE_URL: urls.apiMigration },
      stdio: 'inherit',
    });
    run(process.execPath, [prisma, 'migrate', 'deploy'], { env, stdio: 'inherit' });
    run(
      process.execPath,
      [
        '--experimental-vm-modules',
        '../node_modules/jest/bin/jest.js',
        '--config',
        'jest.database.config.cjs',
        '--runInBand',
      ],
      {
        env: {
          ...env,
          SUIVI_TEST_DEMO_MIGRATION_URL: urls.demoMigration,
          SUIVI_TEST_DEMO_DATABASE_URL: urls.demoApp,
          SUIVI_TEST_API_DATABASE_URL: urls.apiApp,
          SUIVI_TEST_EVENTS_DATABASE_URL: urls.eventsApp,
          SUIVI_TEST_EVENTS_MIGRATION_URL: urls.eventsMigration,
        },
        stdio: 'inherit',
        timeout: 600000,
      },
    );
  }
  if (withBrowser) {
    const e2eEnv = {
      ...env,
      DATABASE_URL: urls.e2eApp,
      DIRECT_DATABASE_URL: urls.e2eMigration,
      FRONTEND_ORIGIN: 'http://127.0.0.1:4174',
    };
    run(process.execPath, [prisma, 'migrate', 'deploy'], { env: e2eEnv, stdio: 'inherit' });
    // Le projet Playwright initialisation crée le compte depuis la vraie interface.
    const login = 'e2e.admin.' + randomBytes(8).toString('hex') + '@example.test';
    const password = randomBytes(24).toString('base64url');
    run(
      process.execPath,
      [
        '../node_modules/@playwright/test/cli.js',
        'test',
        '--config',
        '../playwright.config.ts',
        ...browserArguments,
      ],
      {
        env: {
          ...e2eEnv,
          SUIVI_E2E_LOGIN: login,
          SUIVI_E2E_PASSWORD: password,
          SUIVI_TEST_E2E_DATABASE_URL: urls.e2eApp,
        },
        stdio: 'inherit',
        timeout: 600000,
      },
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Échec des tests PostgreSQL.');
  process.exitCode = 1;
} finally {
  if (started) {
    const stopped = spawnSync(
      join(bin, 'pg_ctl.exe'),
      ['-D', join(cluster, 'data'), '-m', 'fast', '-w', '-t', '90', 'stop'],
      { windowsHide: true, stdio: 'ignore', timeout: 100000 },
    );
    if (stopped.status !== 0) {
      const status = spawnSync(join(bin, 'pg_ctl.exe'), ['-D', join(cluster, 'data'), 'status'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 10000,
      });
      if (status.status !== 3) {
        console.error('Arrêt de l’instance de test à vérifier.');
        process.exitCode = 1;
      }
    }
  }
  if (cluster)
    console.log(`Journaux et fichiers temporaires conservés pour diagnostic : ${cluster}`);
}
