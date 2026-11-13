import { config } from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
});
try {
  const result = await pool.query(
    "SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, rolsuper AS superuser FROM pg_roles WHERE rolname = current_user",
  );
  if (result.rows[0]?.superuser !== false) {
    throw new Error('Le rôle applicatif ne doit pas être superutilisateur.');
  }
  console.log(JSON.stringify(result.rows[0], null, 2));
} catch (error) {
  console.error(
    'Échec du contrôle PostgreSQL :',
    error instanceof Error ? error.message : 'inconnu',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
