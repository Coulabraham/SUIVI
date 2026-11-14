import { Dexie, type Table } from 'dexie';

export interface SealedPayload {
  format: 1;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}
export interface LocalScope {
  userId: string;
  departmentId: string;
  deviceId: string;
  generation: number;
  authzVersion: number;
  credentialVersion: number;
}
export type LocalOperationType =
  'MEMBER_CREATE' | 'MEMBER_UPDATE' | 'MEMBER_ARCHIVE' | 'PAYMENT_CREATE';
export type LocalOperationState = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
export interface LocalOperation {
  id: string;
  scope: string;
  type: LocalOperationType;
  entityId: string;
  userId: string;
  departmentId: string;
  deviceId: string;
  createdAt: string;
  baseVersion: number | null;
  dependsOn: string[];
  digest: string;
  payload: SealedPayload;
  state: LocalOperationState;
  attempts: number;
  processingLeaseUntil: string | null;
  nextAttemptAt: string | null;
  errorCode: string | null;
  serverReceipt: string | null;
}
export interface LocalProjection {
  scope: string;
  kind: 'MEMBER' | 'PAYMENT';
  id: string;
  version: number;
  pendingOperationId: string;
  payload: SealedPayload;
}
interface Setting {
  key: string;
  value: string;
}

/** Aucun profil, mot de passe ou token n'est stocké en clair. Les données métier
 * sont des enveloppes chiffrées. Cette couche n'accorde aucune autorisation ;
 * l'activation métier attend la politique de session et le protocole serveur. */
export class LocalDatabase extends Dexie {
  settings!: Table<Setting, string>;
  operations!: Table<LocalOperation, string>;
  projections!: Table<LocalProjection, [string, string, string]>;
  constructor(name = 'suivi-local') {
    super(name);
    this.version(1).stores({
      settings: '&key',
      operations: '&id, [scope+state], [scope+createdAt], [scope+entityId]',
      projections: '[scope+kind+id], scope, [scope+kind]',
    });
  }
}
export const localDatabase = new LocalDatabase();
export function scopeKey(scope: LocalScope) {
  return JSON.stringify([
    scope.userId,
    scope.departmentId,
    scope.deviceId,
    scope.generation,
    scope.authzVersion,
    scope.credentialVersion,
  ]);
}
/** Projection et commande deviennent visibles ensemble, après commit IndexedDB.
 * Les reçus serveur et les transitions de synchronisation seront ajoutés en phase 12. */
export async function appendPendingOperation(
  db: LocalDatabase,
  scope: LocalScope,
  input: Omit<
    LocalOperation,
    | 'scope'
    | 'digest'
    | 'state'
    | 'attempts'
    | 'processingLeaseUntil'
    | 'nextAttemptAt'
    | 'errorCode'
    | 'serverReceipt'
  >,
  projection: Omit<LocalProjection, 'scope' | 'pendingOperationId'>,
) {
  const key = scopeKey(scope);
  if (
    input.userId !== scope.userId ||
    input.departmentId !== scope.departmentId ||
    input.deviceId !== scope.deviceId ||
    input.entityId !== projection.id
  )
    throw new Error('Le contexte de l’opération locale ne correspond pas à son périmètre.');
  if ((input.type === 'PAYMENT_CREATE' ? 'PAYMENT' : 'MEMBER') !== projection.kind)
    throw new Error('La projection ne correspond pas au type de l’opération locale.');
  // Empreinte de l'enveloppe chiffrée et de ses métadonnées, jamais d'un montant
  // ou de coordonnées en clair. Cryptographie AVANT la transaction Dexie.
  const descriptor = JSON.stringify([
    key,
    input.id,
    input.type,
    input.entityId,
    input.createdAt,
    input.baseVersion,
    input.dependsOn,
    projection.version,
    projection.kind,
    Array.from(input.payload.iv),
    Array.from(input.payload.ciphertext),
    Array.from(projection.payload.iv),
    Array.from(projection.payload.ciphertext),
  ]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(descriptor));
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return db.transaction('rw', db.operations, db.projections, async () => {
    const existing = await db.operations.get(input.id);
    if (existing) {
      if (
        existing.scope !== key ||
        existing.digest !== digest ||
        existing.entityId !== input.entityId ||
        existing.type !== input.type
      )
        throw new Error('Cet identifiant local est déjà utilisé pour une autre opération.');
      return existing;
    }
    for (const dependencyId of input.dependsOn) {
      const dependency = await db.operations.get(dependencyId);
      if (!dependency || dependency.scope !== key || dependencyId === input.id)
        throw new Error('Une dépendance locale est absente ou appartient à un autre périmètre.');
    }
    const previous = await db.projections.get([key, projection.kind, projection.id]);
    if (previous && input.type === 'PAYMENT_CREATE')
      throw new Error(
        'Un encaissement local existe déjà pour cet identifiant. Une correction financière exige une décision explicite du serveur.',
      );
    if (previous && !input.dependsOn.includes(previous.pendingOperationId))
      throw new Error('Une modification locale existe déjà ; sa dépendance doit être conservée.');
    const operation: LocalOperation = {
      ...input,
      digest,
      scope: key,
      state: 'PENDING',
      attempts: 0,
      processingLeaseUntil: null,
      nextAttemptAt: null,
      errorCode: null,
      serverReceipt: null,
    };
    await db.operations.add(operation);
    await db.projections.put({ ...projection, scope: key, pendingOperationId: operation.id });
    return operation;
  });
}
