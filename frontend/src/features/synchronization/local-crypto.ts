import type { SealedPayload } from './local-database';

const encoder = new TextEncoder();
const bytes = (value: Uint8Array) => new Uint8Array(value);
export function newSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}
export async function localKey(secret: string, salt: Uint8Array) {
  if (secret.length < 12 || salt.byteLength !== 16)
    throw new Error('La protection locale exige au moins douze caractères et un sel valide.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(salt), iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
/** L'identité du périmètre sert de donnée authentifiée : déplacer une enveloppe
 * vers un autre utilisateur/département ne permet pas de la déchiffrer. */
export async function seal(value: unknown, key: CryptoKey, scope: string): Promise<SealedPayload> {
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error('Les données à protéger doivent être sérialisables.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(scope) },
    key,
    encoder.encode(serialized),
  );
  return { format: 1, iv, ciphertext: new Uint8Array(ciphertext) };
}
export async function unseal<T>(payload: SealedPayload, key: CryptoKey, scope: string): Promise<T> {
  if (payload.format !== 1 || payload.iv.byteLength !== 12)
    throw new Error('Le format des données locales est invalide.');
  const value = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(payload.iv), additionalData: encoder.encode(scope) },
    key,
    bytes(payload.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(value)) as T;
}
