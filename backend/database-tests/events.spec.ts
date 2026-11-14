import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/create-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { Environment } from '../src/config/environment.js';
import { hashInitialPassword } from '../src/common/passwords.js';
import { EventRecorder } from '../src/events/event-recorder.js';
import { NotificationPublisher } from '../src/events/notification-publisher.js';

const secret = randomBytes(24).toString('base64url');
const devices = [randomUUID(), randomUUID(), randomUUID()];
let app: INestApplication,
  db: DatabaseService,
  owner: pg.Pool,
  adminId: string,
  secondAdminId: string,
  managerId: string,
  departmentA: string,
  departmentB: string,
  memberId: string,
  memberAuditId: string,
  notificationId: string,
  departmentNoticeId: string;
let adminToken: string, managerToken: string, otherToken: string;
const loginNames = [
  'events.admin.' + randomUUID(),
  'events.manager.' + randomUUID(),
  'events.other.' + randomUUID(),
];
const signIn = (position: number, device = devices[position]!) =>
  request(app.getHttpServer()).post('/api/v1/auth/login').set('X-SUIVI-CLIENT', 'web').send({
    login: loginNames[position],
    password: secret,
    deviceId: device,
    deviceLabel: 'Recette événements',
  });
const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token = adminToken) => {
  const client = request(app.getHttpServer());
  return client[method]('/api/v1/' + path)
    .set('X-SUIVI-CLIENT', 'web')
    .auth(token, { type: 'bearer' });
};

beforeAll(async () => {
  const url = process.env.SUIVI_TEST_EVENTS_DATABASE_URL;
  const ownerUrl = process.env.SUIVI_TEST_EVENTS_MIGRATION_URL;
  if (!url || !ownerUrl || !/^\/suivi_test_.*_events$/.test(new URL(url).pathname))
    throw new Error('Base événements éphémère obligatoire.');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useFactory({
      factory: () =>
        new DatabaseService(new ConfigService<Environment, true>({ DATABASE_URL: url })),
    })
    .compile();
  app = module.createNestApplication();
  configureApp(app);
  await app.init();
  db = app.get(DatabaseService);
  owner = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  const passwordHash = await hashInitialPassword(secret);
  adminId = (
    await db.prisma.user.create({
      data: {
        loginIdentifier: loginNames[0]!,
        loginNormalized: loginNames[0]!,
        firstName: 'Admin',
        lastName: 'Événements',
        role: 'SUPER_ADMIN',
        passwordHash,
        mustChangePassword: false,
      },
    })
  ).id;
  secondAdminId = (
    await db.prisma.user.create({
      data: {
        loginIdentifier: 'second.' + randomUUID(),
        loginNormalized: 'second.' + randomUUID(),
        firstName: 'Second',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        passwordHash,
        mustChangePassword: false,
      },
    })
  ).id;
  departmentA = (
    await db.prisma.department.create({ data: { name: 'Événements A', status: 'ACTIVE' } })
  ).id;
  departmentB = (
    await db.prisma.department.create({ data: { name: 'Événements B', status: 'ACTIVE' } })
  ).id;
  for (const [index, departmentId] of [
    [1, departmentA],
    [2, departmentB],
  ] as const) {
    const row = await db.prisma.user.create({
      data: {
        loginIdentifier: loginNames[index]!,
        loginNormalized: loginNames[index]!,
        firstName: 'Responsable',
        lastName: String(index),
        role: 'MANAGER',
        departmentId,
        passwordHash,
        mustChangePassword: false,
      },
    });
    if (index === 1) managerId = row.id;
  }
  adminToken = (await signIn(0).expect(200)).body.data.accessToken;
  managerToken = (await signIn(1).expect(200)).body.data.accessToken;
  otherToken = (await signIn(2).expect(200)).body.data.accessToken;
}, 120000);
afterAll(async () => {
  await owner?.end();
  await app?.close();
});

describe('Phase 10 — événements et confidentialité', () => {
  it('diffuse un événement aux administrateurs actifs sans révéler de données d’autres départements', async () => {
    memberId = (
      await api('post', 'members', managerToken)
        .send({
          memberNumber: 'EVENTS-1',
          firstName: 'Initial',
          lastName: 'Membre',
          departmentId: departmentA,
        })
        .expect(201)
    ).body.data.id;
    const audit = await db.prisma.auditLog.findFirstOrThrow({
      where: { action: 'MEMBER_CREATED', entityId: memberId },
    });
    memberAuditId = audit.id;
    const rows = await db.prisma.notification.findMany({
      where: { eventKey: 'audit:' + audit.id },
    });
    expect(rows.map((row) => row.recipientId).sort()).toEqual([adminId, secondAdminId].sort());
    notificationId = rows.find((row) => row.recipientId === adminId)!.id;
    await api('get', 'notifications/' + notificationId, otherToken).expect(404);
    await api('patch', 'notifications/' + notificationId + '/read', managerToken)
      .send({ read: true })
      .expect(404);
    await api('get', 'notifications?departmentId=' + departmentA, otherToken).expect(403);
    await api('get', 'notifications?recipientId=' + adminId, managerToken).expect(400);
    expect((await api('get', 'notifications', otherToken)).body.data.total).toBe(0);
  });
  it('déduplique une publication répétée du même événement', async () => {
    const event = await db.prisma.auditLog.findUniqueOrThrow({ where: { id: memberAuditId } });
    const count = await db.prisma.notification.count();
    await db.prisma.$transaction(async (tx) => {
      await app.get(NotificationPublisher).publish(tx, event);
      await app.get(NotificationPublisher).publish(tx, event);
    });
    expect(await db.prisma.notification.count()).toBe(count);
  });
  it('n’émet ni notification ni nouvel audit pour les consultations ordinaires', async () => {
    const audits = await db.prisma.auditLog.count();
    const notices = await db.prisma.notification.count();
    await api('get', 'members', managerToken).expect(200);
    await api('get', 'dashboard', managerToken).expect(200);
    await api('get', 'audit').expect(200);
    await api('get', 'audit/' + memberAuditId).expect(200);
    await api('get', 'notifications').expect(200);
    await api('get', 'notifications/unread-count').expect(200);
    expect(await db.prisma.auditLog.count()).toBe(audits);
    expect(await db.prisma.notification.count()).toBe(notices);
  });
  it('annule aussi la notification et l’audit si la transaction métier échoue', async () => {
    const audits = await db.prisma.auditLog.count();
    const notices = await db.prisma.notification.count();
    await expect(
      db.prisma.$transaction(async (tx) => {
        await app.get(EventRecorder).record(tx, {
          actorId: adminId,
          actorRole: 'SUPER_ADMIN',
          departmentId: departmentA,
          action: 'MEMBER_UPDATED',
          entityType: 'Member',
          entityId: memberId,
          outcome: 'SUCCESS',
          requestId: randomUUID(),
        });
        throw new Error('rollback-test');
      }),
    ).rejects.toThrow('rollback-test');
    expect(await db.prisma.auditLog.count()).toBe(audits);
    expect(await db.prisma.notification.count()).toBe(notices);
  });
  it('conserve une seule date de lecture et le contenu, même en cas de répétition', async () => {
    const first = (
      await api('patch', 'notifications/' + notificationId + '/read')
        .send({ read: true })
        .expect(200)
    ).body.data;
    const second = (
      await api('patch', 'notifications/' + notificationId + '/read')
        .send({ read: true })
        .expect(200)
    ).body.data;
    expect(second.readAt).toBe(first.readAt);
    expect(second.title).toBe(first.title);
    expect(
      (await api('get', 'notifications?readState=UNREAD')).body.data.items.some(
        (row: { id: string }) => row.id === notificationId,
      ),
    ).toBe(false);
    await api('patch', 'notifications/' + notificationId + '/read')
      .send({ read: true, title: 'Intrusion' })
      .expect(400);
    await api('patch', 'notifications/' + notificationId + '/read')
      .send({ read: false })
      .expect(400);
    await api('post', 'notifications').send({ title: 'Fausse notification' }).expect(404);
    await api('delete', 'notifications/' + notificationId).expect(404);
  });
  it('notifie le responsable concerné par une modification administrative et marque seulement sa boîte', async () => {
    memberId = (
      await api('post', 'members')
        .send({
          memberNumber: 'EVENTS-2',
          firstName: 'Administratif',
          lastName: 'Membre',
          departmentId: departmentA,
        })
        .expect(201)
    ).body.data.id;
    const before = (await api('get', 'notifications/unread-count', managerToken)).body.data.unread;
    expect(before).toBeGreaterThan(0);
    const marked = await api('patch', 'notifications/read-all', managerToken)
      .send({ read: true })
      .expect(200);
    expect(marked.body.data.updated).toBe(before);
    expect((await api('get', 'notifications/unread-count', managerToken)).body.data.unread).toBe(0);
    expect(
      (await api('patch', 'notifications/read-all', managerToken).send({ read: true })).body.data
        .updated,
    ).toBe(0);
    expect((await api('get', 'notifications/unread-count')).body.data.unread).toBeGreaterThan(0);
  });
  it('expose les valeurs avant/après et les références d’audit aux seuls administrateurs', async () => {
    await api('patch', 'members/' + memberId, managerToken)
      .send({ version: 1, firstName: 'Modifié' })
      .expect(200);
    const list = await api(
      'get',
      'audit?action=MEMBER_UPDATED&departmentId=' + departmentA + '&pageSize=1',
    ).expect(200);
    const row = list.body.data.items[0];
    expect(row.actorId).toBe(managerId);
    expect(row.actorRole).toBe('MANAGER');
    expect(row.beforeValue).toBeUndefined();
    expect(row.deviceId).toBe(devices[1]);
    expect(row.requestId).toMatch(/^[0-9a-f-]{36}$/);
    const detail = (await api('get', 'audit/' + row.id).expect(200)).body.data;
    expect(detail.beforeValue.firstName).toBe('Administratif');
    expect(detail.afterValue.firstName).toBe('Modifié');
    await api('get', 'audit', managerToken).expect(403);
    await api('get', 'audit/' + row.id, otherToken).expect(403);
    await api('patch', 'audit/' + row.id)
      .send({ action: 'MODIFIED' })
      .expect(404);
    await api('delete', 'audit/' + row.id).expect(404);
  });
  it('pagine et valide les filtres sans accepter de paramètres mal formés', async () => {
    const first = (await api('get', 'audit?pageSize=1').expect(200)).body.data;
    const second = (await api('get', 'audit?pageSize=1&page=2').expect(200)).body.data;
    expect(first.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(first.total).toBe(second.total);
    await api('get', 'audit?from=2026-11-14T00:00:00Z&to=2026-11-13T00:00:00Z').expect(400);
    await api('get', 'audit?actorId=bad').expect(400);
    await api('get', 'audit?q=one&q=two').expect(400);
    await api('get', 'notifications?readState=BAD').expect(400);
    await api('get', 'notifications?pageSize=101').expect(400);
    expect(
      (await api('get', 'audit?entityId=' + memberId + '&outcome=SUCCESS')).body.data.items.every(
        (row: { entityId: string }) => row.entityId === memberId,
      ),
    ).toBe(true);
  });
  it('retire les secrets imbriqués avant leur écriture et leur consultation', async () => {
    const event = await db.prisma.$transaction((tx) =>
      app.get(EventRecorder).record(tx, {
        actorId: adminId,
        actorRole: 'SUPER_ADMIN',
        action: 'SECURITY_SANITIZATION_TEST',
        entityType: 'User',
        entityId: adminId,
        outcome: 'SUCCESS',
        requestId: randomUUID(),
        afterValue: {
          publicName: 'Visible',
          password: 'never-store-this',
          initialPassword: 'never-store-either',
          nested: { refreshToken: 'never-store-token', accessToken: 'never-expose-token' },
        },
      }),
    );
    const body = (await api('get', 'audit/' + event.id).expect(200)).body.data;
    expect(body.afterValue).toEqual({ publicName: 'Visible', nested: {} });
    expect(JSON.stringify(event)).not.toContain('never-store');
  });
  it('alerte sur un second appareil, sans alerter sur les connexions ordinaires', async () => {
    await signIn(1).expect(200);
    expect(
      await db.prisma.auditLog.count({ where: { action: 'UNUSUAL_LOGIN', actorId: managerId } }),
    ).toBe(0);
    const device = randomUUID();
    await signIn(1, device).expect(200);
    managerToken = (await signIn(1, device).expect(200)).body.data.accessToken;
    const event = await db.prisma.auditLog.findFirstOrThrow({
      where: { action: 'UNUSUAL_LOGIN', actorId: managerId },
    });
    expect(
      await db.prisma.auditLog.count({ where: { action: 'UNUSUAL_LOGIN', actorId: managerId } }),
    ).toBe(1);
    const own = await db.prisma.notification.findFirstOrThrow({
      where: { eventKey: 'audit:' + event.id, recipientId: managerId },
    });
    expect(own.type).toBe('SECURITY');
    expect(own.departmentId).toBeNull();
    expect(
      (await api('get', 'notifications?type=SECURITY', managerToken)).body.data.items.some(
        (row: { id: string }) => row.id === own.id,
      ),
    ).toBe(true);
  });
  it('masque les anciennes notifications départementales après réaffectation, y compris à la lecture groupée', async () => {
    await api('patch', 'members/' + memberId)
      .send({ version: 2, neighborhood: 'Modifié par administrateur' })
      .expect(200);
    departmentNoticeId = (
      await db.prisma.notification.findFirstOrThrow({
        where: { recipientId: managerId, departmentId: departmentA, readAt: null },
      })
    ).id;
    const departmentC = (
      await api('post', 'departments').send({ name: 'Événements C', status: 'ACTIVE' }).expect(201)
    ).body.data.id;
    const manager = (await api('get', 'managers/' + managerId)).body.data;
    await api('patch', 'managers/' + managerId)
      .send({
        version: manager.version,
        departmentId: departmentC,
        reason: 'Nouvelle affectation contrôlée',
      })
      .expect(200);
    await api('get', 'notifications', managerToken).expect(401);
    managerToken = (await signIn(1).expect(200)).body.data.accessToken;
    await api('get', 'notifications/' + departmentNoticeId, managerToken).expect(404);
    await api('patch', 'notifications/' + departmentNoticeId + '/read', managerToken)
      .send({ read: true })
      .expect(404);
    expect(
      (await api('get', 'notifications', managerToken)).body.data.items.every(
        (row: { departmentId: string | null }) =>
          row.departmentId === null || row.departmentId === departmentC,
      ),
    ).toBe(true);
    await api('patch', 'notifications/read-all', managerToken).send({ read: true }).expect(200);
    expect(
      (await db.prisma.notification.findUniqueOrThrow({ where: { id: departmentNoticeId } }))
        .readAt,
    ).toBeNull();
  });
  it('prépare la publication des échecs de synchronisation sans route de fabrication publique', async () => {
    const manager = await db.prisma.user.findUniqueOrThrow({ where: { id: managerId } });
    const event = await db.prisma.$transaction((tx) =>
      app.get(EventRecorder).record(tx, {
        actorId: managerId,
        actorRole: 'MANAGER',
        departmentId: manager.departmentId,
        deviceId: devices[1]!,
        action: 'SYNC_FAILED',
        entityType: 'SyncOperation',
        entityId: randomUUID(),
        outcome: 'FAILURE',
        requestId: randomUUID(),
      }),
    );
    expect(
      await db.prisma.notification.count({
        where: { eventKey: 'audit:' + event.id, type: 'ERROR' },
      }),
    ).toBe(3);
    expect((await api('get', 'notifications?type=ERROR', managerToken)).body.data.total).toBe(1);
  });
  it('protège l’historique et les accusés au niveau PostgreSQL', async () => {
    await expect(
      db.prisma.notification.update({ where: { id: notificationId }, data: { title: 'Changed' } }),
    ).rejects.toBeDefined();
    await expect(
      owner.query('UPDATE notifications SET title=$1 WHERE id=$2', ['Changed', notificationId]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      owner.query('UPDATE notifications SET read_at=NULL WHERE id=$1', [notificationId]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      owner.query('DELETE FROM notifications WHERE id=$1', [notificationId]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      owner.query('UPDATE audit_logs SET action=$1 WHERE id=$2', ['CHANGED', memberAuditId]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
