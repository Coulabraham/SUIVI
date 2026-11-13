import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(target)) {
  if (!/^AUTH_JWT_SECRET=/m.test(readFileSync(target, 'utf8')))
    appendFileSync(target, '\nAUTH_JWT_SECRET=' + randomBytes(48).toString('base64url') + '\n');
  console.log('Configuration locale déjà présente ; aucun secret remplacé.');
} else {
  const appPassword = randomBytes(32).toString('base64url');
  const migrationPassword = randomBytes(32).toString('base64url');
  const adminPassword = randomBytes(32).toString('base64url');
  const content = [
    '# Développement local uniquement — ne pas versionner ni utiliser en production.',
    'NODE_ENV=development',
    'HOST=127.0.0.1',
    'PORT=3000',
    'FRONTEND_ORIGIN=http://127.0.0.1:5173',
    'API_DOCS_ENABLED=true',
    'AUTH_JWT_SECRET=' + randomBytes(48).toString('base64url'),
    `DATABASE_URL=postgresql://suivi_app:${appPassword}@127.0.0.1:5433/suivi_dev`,
    `DIRECT_DATABASE_URL=postgresql://suivi_migrator:${migrationPassword}@127.0.0.1:5433/suivi_dev`,
    `POSTGRES_ADMIN_PASSWORD=${adminPassword}`,
    `POSTGRES_APP_PASSWORD=${appPassword}`,
    `POSTGRES_MIGRATION_PASSWORD=${migrationPassword}`,
    'POSTGRES_PORT=5433',
    '',
  ].join('\n');
  writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  console.log('Configuration locale créée avec des secrets aléatoires, sans compte applicatif.');
}
