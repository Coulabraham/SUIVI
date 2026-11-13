import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
try {
  const url = new URL(process.env.DIRECT_DATABASE_URL ?? '');
  if (!['postgresql:', 'postgres:'].includes(url.protocol))
    throw new Error('URL PostgreSQL requise.');
  const bin =
    process.env.SUIVI_POSTGRES_BIN ??
    (process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'SUIVI', 'postgresql-18.7-1', 'pgsql', 'bin')
      : '');
  const executable = bin
    ? join(bin, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump')
    : 'pg_dump';
  const directory = join(process.env.LOCALAPPDATA ?? homedir(), 'SUIVI', 'backups');
  await mkdir(directory, { recursive: true });
  const database = decodeURIComponent(url.pathname.slice(1));
  const filename = `${database.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}.dump`;
  const target = join(directory, filename);
  if (existsSync(target)) throw new Error('La cible de sauvegarde existe déjà.');
  const result = spawnSync(
    executable,
    [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      database,
      '--format=custom',
      '--no-owner',
      '--file',
      target,
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error('pg_dump a échoué ; aucune migration ne doit être lancée avant vérification.');
  console.log(`Sauvegarde PostgreSQL créée hors du projet : ${target}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Échec de la sauvegarde.');
  process.exitCode = 1;
}
