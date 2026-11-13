import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

const action = process.argv[2];
if (process.platform !== 'win32' || !['start', 'stop', 'status'].includes(action)) {
  throw new Error('Usage Windows : npm run db:local:start, db:local:stop ou db:local:status.');
}
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
config({ path: join(projectRoot, '.env'), quiet: true });
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const port = Number(databaseUrl.port);
if (
  databaseUrl.hostname !== '127.0.0.1' ||
  databaseUrl.pathname !== '/suivi_dev' ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535
) {
  throw new Error('Ce script gère seulement suivi_dev sur 127.0.0.1, avec un port explicite.');
}
const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) throw new Error('LOCALAPPDATA absent.');
const release = '18.7-1';
const source = `https://get.enterprisedb.com/postgresql/postgresql-${release}-windows-x64-binaries.zip`;
const runtimeRoot = join(localAppData, 'SUIVI');
const installation = join(runtimeRoot, `postgresql-${release}`);
const bin = join(installation, 'pgsql', 'bin');
const projectId = createHash('sha256')
  .update(normalize(projectRoot).toLowerCase())
  .digest('hex')
  .slice(0, 12);
const instance = join(runtimeRoot, 'instances', projectId);
const dataDirectory = join(instance, 'data');
const provisioned = join(instance, 'provisioned.json');

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable.split(/[\\/]/).at(-1)} : ${String(result.stderr || result.stdout || 'échec sans sortie').trim()}`,
    );
  }
  return result.stdout?.trim() ?? '';
}

async function installBinaries() {
  if (existsSync(join(installation, 'installation.json'))) return;
  const cache = join(runtimeRoot, 'cache');
  const archive = join(cache, `postgresql-${release}-windows-x64-binaries.zip`);
  await mkdir(cache, { recursive: true });
  if (!existsSync(archive)) {
    console.log('Téléchargement des binaires PostgreSQL officiels EDB…');
    const response = await fetch(source, { signal: AbortSignal.timeout(1200000) });
    if (!response.ok || !response.body)
      throw new Error(`Téléchargement refusé : HTTP ${response.status}`);
    const partialArchive = `${archive}.download`;
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(partialArchive, { flags: 'w' }),
    );
    await rename(partialArchive, archive);
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  await mkdir(installation, { recursive: true });
  const extraction = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $destination = [IO.Path]::GetFullPath($env:SUIVI_PG_DESTINATION)
    $zip = [IO.Compression.ZipFile]::OpenRead($env:SUIVI_PG_ARCHIVE)
    try {
      foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^pgsql/(bin|lib|share)/') { continue }
        $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
        if (-not $target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Chemin ZIP non autorisé' }
        if ($entry.Name -eq '') { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
      }
    } finally { $zip.Dispose() }
  `;
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', extraction], {
    env: { ...process.env, SUIVI_PG_DESTINATION: installation, SUIVI_PG_ARCHIVE: archive },
  });
  const version = run(join(bin, 'postgres.exe'), ['--version']);
  if (!version.includes('18.7')) throw new Error('Version PostgreSQL inattendue.');
  await writeFile(
    join(installation, 'installation.json'),
    JSON.stringify({ source, sha256, version }, null, 2),
  );
}

async function provisionDatabase() {
  const adminPassword = process.env.POSTGRES_ADMIN_PASSWORD;
  const appPassword = process.env.POSTGRES_APP_PASSWORD;
  const migrationPassword = process.env.POSTGRES_MIGRATION_PASSWORD;
  for (const value of [adminPassword, appPassword, migrationPassword]) {
    if (!value || !/^[A-Za-z0-9_-]{40,}$/.test(value)) {
      throw new Error('Secrets locaux absents ou invalides. Exécuter npm run setup:env.');
    }
  }
  const admin = new pg.Client({
    host: '127.0.0.1',
    port,
    database: 'postgres',
    user: 'suivi_bootstrap',
    password: adminPassword,
    connectionTimeoutMillis: 3000,
  });
  await admin.connect();
  try {
    const directory = await admin.query('SHOW data_directory');
    if (
      normalize(directory.rows[0].data_directory).toLowerCase() !==
      normalize(dataDirectory).toLowerCase()
    ) {
      throw new Error('Le serveur connecté ne correspond pas à cette instance de développement.');
    }
    const literal = (value) => `'${value.replaceAll("'", "''")}'`;
    for (const [role, password] of [
      ['suivi_app', appPassword],
      ['suivi_migrator', migrationPassword],
    ]) {
      const existing = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (!existing.rowCount) {
        await admin.query(
          `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal(password)}`,
        );
      }
    }
    const databases = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      'suivi_dev',
    ]);
    if (!databases.rowCount) await admin.query('CREATE DATABASE suivi_dev OWNER suivi_migrator');
    await admin.query('GRANT CONNECT ON DATABASE suivi_dev TO suivi_app');
    const migrator = new pg.Client({
      connectionString: process.env.DIRECT_DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    await migrator.connect();
    try {
      await migrator.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await migrator.query('GRANT USAGE ON SCHEMA public TO suivi_app');
    } finally {
      await migrator.end();
    }
    await writeFile(
      provisioned,
      JSON.stringify(
        { projectRoot, port, database: 'suivi_dev', createdAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    await admin.query('ALTER ROLE suivi_bootstrap NOLOGIN');
  } finally {
    await admin.end();
  }
}

try {
  if (action === 'start') {
    await installBinaries();
    await mkdir(instance, { recursive: true });
    if (!existsSync(join(dataDirectory, 'PG_VERSION'))) {
      const passwordFile = join(instance, 'init-password');
      if (!/^[A-Za-z0-9_-]{40,}$/.test(process.env.POSTGRES_ADMIN_PASSWORD ?? '')) {
        throw new Error('Exécuter npm run setup:env avant de créer la base.');
      }
      await writeFile(passwordFile, process.env.POSTGRES_ADMIN_PASSWORD, {
        mode: 0o600,
        flag: 'wx',
      });
      try {
        run(join(bin, 'initdb.exe'), [
          '-D',
          dataDirectory,
          '-U',
          'suivi_bootstrap',
          '--pwfile',
          passwordFile,
          '--auth-host=scram-sha-256',
          '--auth-local=scram-sha-256',
          '--encoding=UTF8',
          '--locale=C',
        ]);
      } finally {
        await unlink(passwordFile);
      }
    }
    const state = spawnSync(join(bin, 'pg_ctl.exe'), ['-D', dataDirectory, 'status'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    if (state.status !== 0) {
      run(
        join(bin, 'pg_ctl.exe'),
        [
          '-D',
          dataDirectory,
          '-l',
          join(instance, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${port} -c timezone=UTC`,
          '-w',
          '-t',
          '30',
          'start',
        ],
        { stdio: 'ignore' },
      );
    }
    if (!existsSync(provisioned)) await provisionDatabase();
    console.log(
      `PostgreSQL 18.7 prêt sur 127.0.0.1:${port}, base suivi_dev, rôle applicatif non superutilisateur.`,
    );
  } else if (!existsSync(join(dataDirectory, 'PG_VERSION'))) {
    console.log('Aucune instance PostgreSQL locale initialisée pour ce projet.');
  } else if (action === 'stop') {
    console.log(run(join(bin, 'pg_ctl.exe'), ['-D', dataDirectory, '-m', 'fast', '-w', 'stop']));
  } else {
    console.log(run(join(bin, 'pg_ctl.exe'), ['-D', dataDirectory, 'status']));
    const metadata = JSON.parse(await readFile(provisioned, 'utf8'));
    console.log(`Base ${metadata.database}, port ${metadata.port}, fichiers hors OneDrive.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Erreur de préparation PostgreSQL.');
  process.exitCode = 1;
}
