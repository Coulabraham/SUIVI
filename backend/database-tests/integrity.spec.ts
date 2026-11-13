import { randomBytes, randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { createPrismaClient } from '../src/database/prisma-client.js';
import { bootstrapAdministrator } from '../src/database/seeding.js';
import { verifyPasswordHash } from '../src/common/passwords.js';
import { sundayCalendar } from '../src/collection-weeks/calendar.js';

const appUrl = process.env.SUIVI_TEST_DATABASE_URL;
const ownerUrl = process.env.SUIVI_TEST_MIGRATION_URL;
if (!appUrl || !ownerUrl || !/^\/suivi_test_/.test(new URL(appUrl).pathname))
  throw new Error('Exécuter via npm run test:database.');
const pool = new pg.Pool({ connectionString: appUrl, max: 5 });
const owner = new pg.Pool({ connectionString: ownerUrl, max: 2 });
const prisma = createPrismaClient(appUrl);
const secret = randomBytes(32).toString('base64url');
let adminId: string,
  managerA: string,
  managerB: string,
  deptA: string,
  deptB: string,
  deviceA: string,
  campaign: string,
  weekId: string,
  passwordHash: string;

async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function member(departmentId = deptA) {
  return transaction(async (client) => {
    const id = randomUUID(),
      period = randomUUID();
    await client.query(
      'INSERT INTO members(id,member_number,first_name,last_name,department_id) VALUES($1,$2,$3,$4,$5)',
      [id, randomUUID(), 'Test', 'Membre', departmentId],
    );
    await client.query(
      'INSERT INTO member_department_periods(id,member_id,department_id,starts_at,created_by_id) VALUES($1,$2,$3,$4,$5)',
      [period, id, departmentId, '2026-01-01T00:00:00Z', adminId],
    );
    return { id, period, departmentId };
  });
}

async function audit(
  client: pg.PoolClient,
  entityId: string,
  action = 'PAYMENT_CREATED',
  actorId = managerA,
  role = 'MANAGER',
  departmentId = deptA,
) {
  await client.query(
    'INSERT INTO audit_logs(actor_id,actor_role,department_id,action,entity_type,entity_id,outcome,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      actorId,
      role,
      departmentId,
      action,
      action === 'PAYMENT_CREATED' ? 'Payment' : 'PaymentRevision',
      entityId,
      'SUCCESS',
      randomUUID(),
    ],
  );
}

async function payment(
  amount = '10000',
  options: {
    idempotencyKey?: string;
    actor?: string;
    device?: string;
    week?: string;
    audited?: boolean;
    person?: Awaited<ReturnType<typeof member>>;
  } = {},
) {
  const person = options.person ?? (await member());
  const id = randomUUID();
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO payments(id,member_id,department_id,affiliation_id,collected_by_id,objective_id,collection_week_id,original_amount,method,collected_at,idempotency_key,origin_device_id,member_label_snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'TEST_CASH','2026-11-08T10:00:00Z',$9,$10,'Test Member')`,
      [
        id,
        person.id,
        person.departmentId,
        person.period,
        options.actor ?? managerA,
        campaign,
        options.week ?? weekId,
        amount,
        options.idempotencyKey ?? randomUUID(),
        options.device ?? deviceA,
      ],
    );
    if (options.audited !== false)
      await audit(
        client,
        id,
        'PAYMENT_CREATED',
        options.actor ?? managerA,
        'MANAGER',
        person.departmentId,
      );
  });
  return id;
}

async function revise(
  id: string,
  previous: string,
  next: string,
  revisionNumber: number,
  kind = 'CORRECTION',
  actor = adminId,
  reason = 'Correction documentée',
) {
  return transaction(async (client) => {
    const revisionId = randomUUID();
    await client.query(
      `INSERT INTO payment_revisions(id,payment_id,revision_number,actor_id,reason,kind,previous_amount,new_amount,previous_method,new_method,before_value,after_value)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'TEST_CASH','TEST_CASH','{}','{}')`,
      [revisionId, id, revisionNumber, actor, reason, kind, previous, next],
    );
    await audit(
      client,
      revisionId,
      kind === 'CANCELLATION' ? 'PAYMENT_CANCELLED' : 'PAYMENT_CORRECTED',
      actor,
      actor === adminId ? 'SUPER_ADMIN' : 'MANAGER',
    );
    return revisionId;
  });
}

beforeAll(async () => {
  adminId = await bootstrapAdministrator(prisma, {
    login: 'database.test.admin',
    firstName: 'Test',
    lastName: 'Administrateur',
    password: secret,
  });
  passwordHash = (await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).passwordHash;
  deptA = (await prisma.department.create({ data: { name: 'TEST A', status: 'ACTIVE' } })).id;
  deptB = (await prisma.department.create({ data: { name: 'TEST B', status: 'ACTIVE' } })).id;
  managerA = (
    await prisma.user.create({
      data: {
        loginIdentifier: 'test.manager.a',
        loginNormalized: 'test.manager.a',
        firstName: 'A',
        lastName: 'Test',
        passwordHash,
        role: 'MANAGER',
        departmentId: deptA,
      },
    })
  ).id;
  managerB = (
    await prisma.user.create({
      data: {
        loginIdentifier: 'test.manager.b',
        loginNormalized: 'test.manager.b',
        firstName: 'B',
        lastName: 'Test',
        passwordHash,
        role: 'MANAGER',
        departmentId: deptB,
      },
    })
  ).id;
  deviceA = (await prisma.device.create({ data: { label: 'Test A', userId: managerA } })).id;
  const objective = await prisma.objective.create({
    data: {
      name: 'Campagne de test uniquement',
      targetAmount: 10000000n,
      startsOn: new Date('2026-01-01'),
      endsOn: new Date('2026-12-31'),
      timezone: 'Africa/Abidjan',
      status: 'ACTIVE',
      createdById: adminId,
    },
  });
  campaign = objective.id;
  await prisma.collectionWeek.createMany({
    data: sundayCalendar('2026-01-01', '2026-12-31').map((value) => ({
      ...value,
      objectiveId: campaign,
    })),
  });
  weekId = (
    await prisma.collectionWeek.findFirstOrThrow({
      where: { objectiveId: campaign, startsOn: new Date('2026-11-08') },
    })
  ).id;
}, 30000);

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
  await owner.end();
});

describe('Migrations et sécurité structurelle', () => {
  it('applique les cinq migrations et génère un client Prisma opérationnel', async () => {
    expect(
      (
        await owner.query(
          'SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL',
        )
      ).rows[0].n,
    ).toBe(5);
    expect(await prisma.department.count()).toBe(2);
  });
  it('indexe les préfixes des clés étrangères, y compris leurs colonnes composites', async () => {
    const result = await owner.query(
      "SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace WHERE c.contype='f' AND ns.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL AND ARRAY(SELECT v FROM unnest(i.indkey::smallint[]) WITH ORDINALITY kv(v,n) WHERE n<=cardinality(c.conkey) ORDER BY n)=c.conkey)",
    );
    expect(result.rows).toEqual([]);
  });
  it('bootstrappe sans secret universel, avec hash Argon2id et changement initial', async () => {
    expect(await verifyPasswordHash(passwordHash, secret)).toBe(true);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).mustChangePassword,
    ).toBe(true);
    await expect(
      bootstrapAdministrator(prisma, {
        login: 'another',
        firstName: 'Test',
        lastName: 'Test',
        password: secret,
      }),
    ).rejects.toThrow('existe déjà');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).passwordHash).toBe(
      passwordHash,
    );
  });
  it('interdit un responsable actif supplémentaire et un responsable sans département', async () => {
    const data = {
      loginIdentifier: randomUUID(),
      loginNormalized: randomUUID(),
      firstName: 'X',
      lastName: 'X',
      passwordHash,
      role: 'MANAGER' as const,
    };
    await expect(
      prisma.user.create({ data: { ...data, departmentId: deptA } }),
    ).rejects.toBeDefined();
    await expect(prisma.user.create({ data })).rejects.toBeDefined();
  });
  it('refuse un mot de passe en clair et un login déjà utilisé', async () => {
    await expect(
      prisma.user.create({
        data: {
          loginIdentifier: randomUUID(),
          loginNormalized: randomUUID(),
          firstName: 'X',
          lastName: 'X',
          role: 'SUPER_ADMIN',
          passwordHash: 'plain-text-must-fail',
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.user.create({
        data: {
          loginIdentifier: 'DUPLICATE',
          loginNormalized: 'database.test.admin',
          firstName: 'X',
          lastName: 'X',
          role: 'SUPER_ADMIN',
          passwordHash,
        },
      }),
    ).rejects.toBeDefined();
  });
  it('retire les droits de mutation des journaux et des ajustements', async () => {
    const result = (
      await pool.query(
        "SELECT has_table_privilege(current_user,'payments','UPDATE') AS update_payment, has_table_privilege(current_user,'payment_adjustments','INSERT') AS adjustment, has_table_privilege(current_user,'audit_logs','DELETE') AS audit_delete",
      )
    ).rows[0];
    expect(result).toEqual({ update_payment: false, adjustment: false, audit_delete: false });
  });
});

describe('Affiliations et calendrier', () => {
  it('exige une affiliation cohérente à la fin de transaction', async () => {
    await expect(
      pool.query(
        'INSERT INTO members(member_number,first_name,last_name,department_id) VALUES($1,$2,$3,$4)',
        [randomUUID(), 'Test', 'Test', deptA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const person = await member();
    await expect(
      pool.query('UPDATE members SET department_id=$1,version=version+1 WHERE id=$2', [
        deptB,
        person.id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('refuse des périodes qui se chevauchent et une version non incrémentée', async () => {
    const person = await member();
    await expect(
      pool.query(
        'INSERT INTO member_department_periods(member_id,department_id,starts_at,ends_at,created_by_id) VALUES($1,$2,$3,$4,$5)',
        [person.id, deptB, '2026-02-01', '2026-02-02', adminId],
      ),
    ).rejects.toMatchObject({ code: '23P01' });
    await expect(
      pool.query("UPDATE members SET first_name='Autre' WHERE id=$1", [person.id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('conserve les paiements dans le département historique après transfert', async () => {
    const person = await member();
    const id = await payment('10000', { person });
    await transaction(async (client) => {
      await client.query('UPDATE member_department_periods SET ends_at=$1 WHERE id=$2', [
        '2026-11-09',
        person.period,
      ]);
      await client.query('UPDATE members SET department_id=$1,version=version+1 WHERE id=$2', [
        deptB,
        person.id,
      ]);
      await client.query(
        'INSERT INTO member_department_periods(member_id,department_id,starts_at,created_by_id) VALUES($1,$2,$3,$4)',
        [person.id, deptB, '2026-11-09', adminId],
      );
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).departmentId).toBe(deptA);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: person.id } })).departmentId).toBe(
      deptB,
    );
  });
  it('refuse des semaines hors campagne et une deuxième campagne courante', async () => {
    await expect(
      prisma.collectionWeek.create({
        data: {
          objectiveId: campaign,
          number: 99,
          startsOn: new Date('2027-01-03'),
          endsOn: new Date('2027-01-09'),
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.objective.create({
        data: {
          name: 'Deuxième',
          targetAmount: 1n,
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
          timezone: 'UTC',
          status: 'ACTIVE',
          createdById: adminId,
        },
      }),
    ).rejects.toBeDefined();
  });
});

describe('Transactions financières', () => {
  it.each(['0', '-1', '1.5', '9223372036854775808'])(
    'refuse un montant invalide %s',
    async (amount) => {
      await expect(payment(amount)).rejects.toBeDefined();
    },
  );
  it('accepte des versements multiples et calcule leur cumul sans champ manuel', async () => {
    const person = await member();
    await payment('10000', { person });
    await payment('5000', { person });
    expect(
      (
        await pool.query(
          'SELECT sum(effective_amount)::text AS total FROM payment_balances WHERE member_id=$1',
          [person.id],
        )
      ).rows[0].total,
    ).toBe('15000');
  });
  it('exige un audit au commit et annule la mutation entière si absent', async () => {
    const before = await prisma.payment.count();
    await expect(payment('10000', { audited: false })).rejects.toMatchObject({ code: '23514' });
    expect(await prisma.payment.count()).toBe(before);
  });
  it('déduplique sous concurrence grâce à la clé stable', async () => {
    const key = randomUUID();
    const person = await member();
    const results = await Promise.allSettled([
      payment('10000', { person, idempotencyKey: key }),
      payment('10000', { person, idempotencyKey: key }),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.payment.count({ where: { idempotencyKey: key } })).toBe(1);
  });
  it('refuse un encaisseur d’un autre département et un membre archivé', async () => {
    await expect(payment('10000', { actor: managerB })).rejects.toMatchObject({ code: '23514' });
    const person = await member();
    await pool.query("UPDATE members SET status='ARCHIVED',version=version+1 WHERE id=$1", [
      person.id,
    ]);
    await expect(payment('10000', { person })).rejects.toMatchObject({ code: '23514' });
  });
  it('conserve l’original et applique les écarts 10000 → 8000 → 9000 → 0', async () => {
    const id = await payment();
    await revise(id, '10000', '8000', 1);
    await revise(id, '8000', '9000', 2);
    await revise(id, '9000', '0', 3, 'CANCELLATION');
    expect(
      (
        await pool.query(
          'SELECT effective_amount::text AS amount,status FROM payment_balances WHERE id=$1',
          [id],
        )
      ).rows[0],
    ).toEqual({ amount: '0', status: 'CANCELLED' });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).originalAmount).toBe(10000n);
    expect(await prisma.paymentRevision.count({ where: { paymentId: id } })).toBe(3);
    expect(await prisma.paymentAdjustment.count({ where: { paymentId: id } })).toBe(3);
    await expect(revise(id, '9000', '0', 4, 'CANCELLATION')).rejects.toMatchObject({
      code: '40001',
    });
  });
  it('rejette une affiliation appartenant à un autre membre et une semaine d’une autre campagne', async () => {
    const person = await member();
    const other = await member();
    await expect(
      payment('10000', { person: { ...person, period: other.period } }),
    ).rejects.toMatchObject({ code: '23503' });
    const future = await prisma.objective.create({
      data: {
        name: 'Autre campagne de test',
        targetAmount: 100n,
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
        timezone: 'UTC',
        status: 'PLANNED',
        createdById: adminId,
      },
    });
    const otherWeek = await prisma.collectionWeek.create({
      data: {
        objectiveId: future.id,
        number: 1,
        startsOn: new Date('2026-11-08'),
        endsOn: new Date('2026-11-14'),
      },
    });
    await expect(payment('10000', { week: otherWeek.id })).rejects.toMatchObject({ code: '23503' });
  });
  it('annule aussi l’ajustement et la projection si l’audit de correction manque', async () => {
    const id = await payment();
    await expect(
      transaction(async (client) => {
        await client.query(
          "INSERT INTO payment_revisions(payment_id,revision_number,actor_id,reason,kind,previous_amount,new_amount,previous_method,new_method,before_value,after_value) VALUES($1,1,$2,'Test sans audit','CORRECTION',10000,8000,'TEST_CASH','TEST_CASH','{}','{}')",
          [id, adminId],
        );
      }),
    ).rejects.toMatchObject({ code: '23514' });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).version).toBe(1);
    expect(await prisma.paymentAdjustment.count({ where: { paymentId: id } })).toBe(0);
    expect(
      (
        await pool.query(
          'SELECT effective_amount::text AS amount FROM payment_balances WHERE id=$1',
          [id],
        )
      ).rows[0].amount,
    ).toBe('10000');
  });
  it('trace un changement de mode sans créer de faux ajustement monétaire', async () => {
    const id = await payment();
    await transaction(async (client) => {
      const revisionId = randomUUID();
      await client.query(
        "INSERT INTO payment_revisions(id,payment_id,revision_number,actor_id,reason,kind,previous_amount,new_amount,previous_method,new_method,before_value,after_value) VALUES($1,$2,1,$3,'Mode de test corrigé','CORRECTION',10000,10000,'TEST_CASH','TEST_OTHER','{}','{}')",
        [revisionId, id, adminId],
      );
      await audit(client, revisionId, 'PAYMENT_CORRECTED', adminId, 'SUPER_ADMIN');
    });
    expect(await prisma.paymentAdjustment.count({ where: { paymentId: id } })).toBe(0);
    expect(
      (await pool.query('SELECT effective_method FROM payment_balances WHERE id=$1', [id])).rows[0]
        .effective_method,
    ).toBe('TEST_OTHER');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).method).toBe('TEST_CASH');
  });
  it('sérialise un encaissement concurrent à l’archivage du membre', async () => {
    const person = await member();
    const client = await pool.connect();
    let outcome: { ok: true } | { ok: false; error: unknown } | undefined;
    try {
      await client.query('BEGIN');
      await client.query("UPDATE members SET status='ARCHIVED',version=version+1 WHERE id=$1", [
        person.id,
      ]);
      const pending = payment('10000', { person }).then(
        () => {
          outcome = { ok: true };
        },
        (error: unknown) => {
          outcome = { ok: false, error };
        },
      );
      const deadline = Date.now() + 3000;
      let blocked = false;
      while (Date.now() < deadline && !outcome) {
        blocked = (
          await pool.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock' AND query ILIKE 'INSERT INTO payments%') AS blocked",
          )
        ).rows[0].blocked as boolean;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await client.query('COMMIT');
      await pending;
      expect(blocked).toBe(true);
      expect(outcome).toMatchObject({ ok: false, error: { code: '23514' } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  it('refuse une justification vide, un auteur responsable et un solde précédent falsifié', async () => {
    const id = await payment();
    await expect(revise(id, '10000', '8000', 1, 'CORRECTION', adminId, ' ')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(revise(id, '10000', '8000', 1, 'CORRECTION', managerA)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(revise(id, '9999', '8000', 1)).rejects.toMatchObject({ code: '23514' });
  });
  it('n’applique qu’une correction pour deux demandes de même version', async () => {
    const id = await payment();
    const results = await Promise.allSettled([
      revise(id, '10000', '8000', 1),
      revise(id, '10000', '9000', 1),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.paymentRevision.count({ where: { paymentId: id } })).toBe(1);
  });
  it('bloque la mutation et la suppression physiques, même via le rôle de migration', async () => {
    const id = await payment();
    await expect(
      owner.query('UPDATE payments SET original_amount=1,version=version+1 WHERE id=$1', [id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(owner.query('DELETE FROM payments WHERE id=$1', [id])).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      owner.query("UPDATE audit_logs SET action='CHANGED' WHERE entity_id=$1", [id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('atteint puis dépasse l’objectif global unique', async () => {
    const total = BigInt(
      (
        await pool.query(
          'SELECT sum(effective_amount)::text AS total FROM payment_balances WHERE objective_id=$1',
          [campaign],
        )
      ).rows[0].total ?? '0',
    );
    await payment((10000000n - total).toString());
    let summary = (
      await pool.query(
        'SELECT sum(effective_amount)::text AS total FROM payment_balances WHERE objective_id=$1',
        [campaign],
      )
    ).rows[0];
    expect(summary.total).toBe('10000000');
    await payment('1000');
    summary = (
      await pool.query(
        'SELECT sum(effective_amount)::text AS total FROM payment_balances WHERE objective_id=$1',
        [campaign],
      )
    ).rows[0];
    expect(summary.total).toBe('10001000');
    expect(
      (await prisma.objective.findUniqueOrThrow({ where: { id: campaign } })).targetAmount,
    ).toBe(10000000n);
  });
  it('préserve un entier au-delà de Number.MAX_SAFE_INTEGER', async () => {
    const id = await payment('9007199254740993');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).originalAmount).toBe(
      9007199254740993n,
    );
    expect(
      (
        await pool.query(
          'SELECT effective_amount::text AS value FROM payment_balances WHERE id=$1',
          [id],
        )
      ).rows[0].value,
    ).toBe('9007199254740993');
  });
});

describe('Appareils, reçus et audit', () => {
  it('empêche de rattacher une session à l’appareil d’un autre utilisateur', async () => {
    await expect(
      prisma.session.create({
        data: {
          userId: managerB,
          deviceId: deviceA,
          credentialVersion: 1,
          authzVersion: 1,
          expiresAt: new Date(Date.now() + 3600000),
        },
      }),
    ).rejects.toBeDefined();
  });
  it('attribue des séquences de synchronisation transactionnelles sans trou sur rollback', async () => {
    const scope = await prisma.syncScope.create({
      data: { key: `DEPARTMENT:${deptA}`, departmentId: deptA },
    });
    const create = (client: pg.PoolClient) =>
      client.query(
        "INSERT INTO sync_changes(scope_id,sequence,entity_type,entity_id,change_type,entity_version,projection) VALUES($1,0,'Member',$2,'UPSERT',1,'{}') RETURNING sequence",
        [scope.id, randomUUID()],
      );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await create(client);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const values = await Promise.all([transaction(create), transaction(create)]);
    expect(values.map((value) => Number(value.rows[0].sequence)).sort()).toEqual([1, 2]);
    expect((await prisma.syncScope.findUniqueOrThrow({ where: { id: scope.id } })).sequence).toBe(
      2n,
    );
  });
  it('fige le payload et le reçu terminal de synchronisation', async () => {
    const op = await prisma.syncOperation.create({
      data: {
        id: randomUUID(),
        userId: managerA,
        departmentId: deptA,
        deviceId: deviceA,
        type: 'MEMBER_CREATE',
        entityId: randomUUID(),
        scopeGeneration: 1,
        authzVersion: 1,
        payload: {},
        requestHash: createHash('sha256').update('fixture').digest('hex'),
        createdAtClient: new Date(),
      },
    });
    await expect(
      prisma.syncOperation.update({ where: { id: op.id }, data: { payload: { changed: true } } }),
    ).rejects.toBeDefined();
    await prisma.syncOperation.update({
      where: { id: op.id },
      data: { status: 'SYNCED', completedAt: new Date() },
    });
    await expect(
      prisma.syncOperation.update({ where: { id: op.id }, data: { resultCode: 'CHANGED' } }),
    ).rejects.toBeDefined();
  });
  it('refuse les secrets dans les snapshots d’audit', async () => {
    await expect(
      prisma.auditLog.create({
        data: {
          action: 'TEST',
          entityType: 'Test',
          outcome: 'FAILURE',
          requestId: randomUUID(),
          afterValue: { password: 'must-not-be-stored' },
        },
      }),
    ).rejects.toBeDefined();
  });
});
