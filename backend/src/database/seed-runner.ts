import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createPrismaClient } from './prisma-client.js';
import { bootstrapAdministrator, seedDemo } from './seeding.js';
import { assertDemoTarget } from './seed-policy.js';

export async function runSeedCli(mode: 'bootstrap' | 'demo'): Promise<void> {
  config({ path: resolve(process.cwd(), '../.env'), quiet: true });
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL est obligatoire.');
  const password = process.env.SUIVI_SEED_PASSWORD;
  if (!password)
    throw new Error('SUIVI_SEED_PASSWORD est obligatoire ; aucun secret universel n’est prévu.');
  if (mode === 'demo') assertDemoTarget(url, process.env.NODE_ENV, process.env.ALLOW_DEMO_SEED);
  const client = createPrismaClient(url);
  try {
    if (mode === 'demo') await seedDemo(client, password, 'explicit-cli');
    else
      await bootstrapAdministrator(client, {
        login: process.env.SUIVI_SEED_LOGIN ?? '',
        firstName: process.env.SUIVI_SEED_FIRST_NAME ?? '',
        lastName: process.env.SUIVI_SEED_LAST_NAME ?? '',
        password,
      });
    console.log(
      mode === 'demo'
        ? 'Données de démonstration créées dans la base dédiée.'
        : 'Administrateur initialisé ; changement du secret requis à la première connexion.',
    );
  } finally {
    await client.$disconnect();
    delete process.env.SUIVI_SEED_PASSWORD;
  }
}
