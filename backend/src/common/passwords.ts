import { hash, argon2id, verify } from 'argon2';

/** Utilisé au bootstrap ; aucune valeur de mot de passe par défaut. */
export async function hashInitialPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Le secret initial doit contenir entre 12 et 256 caractères.');
  }
  return hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

export const verifyPasswordHash = verify;
