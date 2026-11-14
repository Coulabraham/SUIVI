import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { appendPendingOperation, LocalDatabase, scopeKey, type LocalScope } from './local-database';
import { localKey, newSalt, seal, unseal } from './local-crypto';

const context: LocalScope = {
  userId: 'user-a',
  departmentId: 'department-a',
  deviceId: 'device-a',
  generation: 1,
  authzVersion: 1,
  credentialVersion: 1,
};
let db: LocalDatabase;
let fixtureKey: CryptoKey;
let otherKey: CryptoKey;
beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto);
  // Les fixtures d'un même périmètre réutilisent sa clé, comme un espace ouvert.
  // La vraie dérivation coûteuse est exercée ici, sans la répéter pour chaque brouillon.
  [fixtureKey, otherKey] = await Promise.all([
    localKey('Code local de recette unique', newSalt()),
    localKey('Un autre code local de recette', newSalt()),
  ]);
}, 30000);
afterAll(() => vi.unstubAllGlobals());
afterEach(async () => {
  if (db) await db.delete();
});
async function draft(
  type: 'MEMBER_CREATE' | 'MEMBER_UPDATE' | 'PAYMENT_CREATE' = 'MEMBER_CREATE',
  dependency: string[] = [],
) {
  const key = fixtureKey;
  const payload = await seal(
    { firstName: 'Confidentiel', amount: '12000' },
    key,
    scopeKey(context),
  );
  return {
    key,
    input: {
      id: crypto.randomUUID(),
      type,
      entityId: 'entity-a',
      userId: context.userId,
      departmentId: context.departmentId,
      deviceId: context.deviceId,
      createdAt: new Date().toISOString(),
      baseVersion: null,
      dependsOn: dependency,
      payload,
    },
    projection: {
      kind: type === 'PAYMENT_CREATE' ? ('PAYMENT' as const) : ('MEMBER' as const),
      id: 'entity-a',
      version: 1,
      payload,
    },
  };
}
describe('Stockage local chiffré et file durable', () => {
  it('interdit de remplacer un paiement local par une autre création, même liée à la précédente', async () => {
    db = new LocalDatabase('suivi-test-' + crypto.randomUUID());
    const first = await draft('PAYMENT_CREATE');
    await appendPendingOperation(db, context, first.input, first.projection);
    const changed = await seal({ amount: '9000' }, first.key, scopeKey(context));
    await expect(
      appendPendingOperation(
        db,
        context,
        { ...first.input, id: crypto.randomUUID(), dependsOn: [first.input.id], payload: changed },
        { ...first.projection, payload: changed },
      ),
    ).rejects.toThrow('correction financière');
    expect(await db.operations.count()).toBe(1);
    expect((await db.projections.toArray())[0]?.pendingOperationId).toBe(first.input.id);
    expect(
      await unseal((await db.operations.toArray())[0]!.payload, first.key, scopeKey(context)),
    ).toEqual({ firstName: 'Confidentiel', amount: '12000' });
  });
  it('enregistre une projection et sa commande ensemble, sans données métier en clair et avec un UUID stable', async () => {
    db = new LocalDatabase('suivi-test-' + crypto.randomUUID());
    const value = await draft();
    const stored = await appendPendingOperation(db, context, value.input, value.projection);
    expect(stored.state).toBe('PENDING');
    expect(stored.serverReceipt).toBeNull();
    expect(await db.projections.count()).toBe(1);
    expect(JSON.stringify(await db.operations.toArray())).not.toContain('Confidentiel');
    expect(await unseal(stored.payload, value.key, stored.scope)).toEqual({
      firstName: 'Confidentiel',
      amount: '12000',
    });
    await appendPendingOperation(db, context, value.input, value.projection);
    expect(await db.operations.count()).toBe(1);
    const name = db.name;
    db.close();
    db = new LocalDatabase(name);
    expect((await db.operations.get(stored.id))?.state).toBe('PENDING');
  });
  it('refuse un UUID réutilisé avec un autre contenu et ne remplace jamais silencieusement une projection', async () => {
    db = new LocalDatabase('suivi-test-' + crypto.randomUUID());
    const first = await draft();
    await appendPendingOperation(db, context, first.input, first.projection);
    const second = await draft();
    await expect(
      appendPendingOperation(
        db,
        context,
        { ...second.input, id: first.input.id },
        second.projection,
      ),
    ).rejects.toThrow('déjà utilisé');
    await expect(
      appendPendingOperation(db, context, second.input, second.projection),
    ).rejects.toThrow('dépendance');
    expect(await db.operations.count()).toBe(1);
    expect((await db.projections.toArray())[0]?.pendingOperationId).toBe(first.input.id);
  });
  it('annule la commande si l’écriture de sa projection échoue', async () => {
    db = new LocalDatabase('suivi-test-' + crypto.randomUUID());
    const value = await draft();
    const failure = () => {
      throw new Error('Erreur de stockage simulée');
    };
    db.projections.hook('creating', failure);
    await expect(
      appendPendingOperation(db, context, value.input, value.projection),
    ).rejects.toThrow('Erreur de stockage');
    expect(await db.operations.count()).toBe(0);
    expect(await db.projections.count()).toBe(0);
    db.projections.hook('creating').unsubscribe(failure);
  });
  it('chaîne les modifications du même membre et refuse une dépendance étrangère', async () => {
    db = new LocalDatabase('suivi-test-' + crypto.randomUUID());
    const first = await draft();
    await appendPendingOperation(db, context, first.input, first.projection);
    const next = await draft('MEMBER_UPDATE', [first.input.id]);
    await appendPendingOperation(db, context, next.input, { ...next.projection, version: 2 });
    const otherContext = { ...context, departmentId: 'department-b' };
    const last = await draft('MEMBER_UPDATE', [next.input.id]);
    await expect(
      appendPendingOperation(
        db,
        otherContext,
        { ...last.input, departmentId: 'department-b' },
        last.projection,
      ),
    ).rejects.toThrow('autre périmètre');
    expect(await db.operations.count()).toBe(2);
  });
  it('sépare les périmètres et invalide le déchiffrement avec une autre clé, un autre périmètre ou un contenu altéré', async () => {
    const value = await draft('PAYMENT_CREATE');
    const scope = scopeKey(context);
    expect(scopeKey({ ...context, authzVersion: 2 })).not.toBe(scope);
    await expect(
      unseal(value.input.payload, value.key, scopeKey({ ...context, userId: 'user-b' })),
    ).rejects.toThrow();
    await expect(unseal(value.input.payload, otherKey, scope)).rejects.toThrow();
    const corrupt = new Uint8Array(value.input.payload.ciphertext);
    corrupt[0] = (corrupt[0] ?? 0) ^ 1;
    await expect(
      unseal({ ...value.input.payload, ciphertext: corrupt }, value.key, scope),
    ).rejects.toThrow();
    await expect(crypto.subtle.exportKey('raw', value.key)).rejects.toThrow();
  });
});
