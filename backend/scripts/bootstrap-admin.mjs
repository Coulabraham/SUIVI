import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../dist/database/prisma-client.js';
import { bootstrapAdministrator } from '../dist/database/seeding.js';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    'Lancer cette commande dans un terminal interactif personnel ; aucun secret ne sera écrit dans un fichier.',
  );
  process.exitCode = 1;
} else {
  config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'), quiet: true });
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let client;
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL est obligatoire.');
    const target = new URL(process.env.DATABASE_URL);
    console.log(
      'Initialisation du premier Super Administrateur sur ' +
        target.hostname +
        ':' +
        target.port +
        target.pathname,
    );
    const login = (
      await terminal.question(
        'Identifiant unique (nom d’utilisateur ou téléphone choisi par votre organisation) : ',
      )
    ).trim();
    const firstName = (await terminal.question('Prénom : ')).trim();
    const lastName = (await terminal.question('Nom : ')).trim();
    const hours = Number(
      await terminal.question('Validité du mot de passe initial, en heures (1 à 168) : '),
    );
    if (!Number.isInteger(hours) || hours < 1 || hours > 168)
      throw new Error('Durée invalide. Aucun compte créé.');
    if (login.length > 100 || firstName.length > 100 || lastName.length > 100)
      throw new Error('Les identités ne doivent pas dépasser 100 caractères.');
    const confirmation = await terminal.question('Créer ce premier compte ? Tapez CREER : ');
    if (confirmation !== 'CREER') throw new Error('Initialisation annulée.');
    client = createPrismaClient(process.env.DATABASE_URL);
    const password = randomBytes(24).toString('base64url');
    await bootstrapAdministrator(client, {
      login,
      firstName,
      lastName,
      password,
      initialValidityHours: hours,
    });
    console.log('\nCompte créé. Voici le secret initial à affichage unique :');
    console.log(password);
    console.log(
      'Ouvrir /connexion et remplacer immédiatement ce secret. Aucun mot de passe universel ou compte de démonstration n’a été ajouté.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Initialisation impossible.');
    process.exitCode = 1;
  } finally {
    terminal.close();
    await client?.$disconnect();
  }
}
