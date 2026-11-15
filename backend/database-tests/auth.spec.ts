import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../src/config/environment.js';
import { Controller, Get, UseGuards, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/create-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { hashInitialPassword } from '../src/common/passwords.js';
import { JwtGuard, PermissionsGuard, Roles } from '../src/auth/permissions.js';

@Controller('protected-test')
@UseGuards(JwtGuard, PermissionsGuard)
class RestrictedController {
  @Get() @Roles('SUPER_ADMIN') read() {
    return { data: true };
  }
}
const path = '/api/v1/';
const secret = randomBytes(24).toString('base64url');
const next = randomBytes(24).toString('base64url');
const login = 'auth.' + randomUUID();
const deviceId = randomUUID();
let app: INestApplication,
  db: DatabaseService,
  userId: string,
  token: string,
  refreshCookie: string;
const signIn = (password = secret, identity = login, deviceLabel = 'Test navigateur') =>
  request(app.getHttpServer())
    .post(path + 'auth/login')
    .set('X-SUIVI-CLIENT', 'web')
    .send({ login: identity, password, deviceId, deviceLabel });
const cookieOf = (response: { headers: Record<string, unknown> }) => {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? (header[0] as string | undefined) : undefined;
  if (!value) throw new Error('Cookie de session absent.');
  return value;
};

beforeAll(async () => {
  if (
    !process.env.SUIVI_TEST_DATABASE_URL ||
    !/^\/suivi_test_/.test(new URL(process.env.SUIVI_TEST_DATABASE_URL).pathname)
  )
    throw new Error('Base de test obligatoire.');
  const apiUrl = process.env.SUIVI_TEST_API_DATABASE_URL;
  if (!apiUrl || !/^\/suivi_test_/.test(new URL(apiUrl).pathname))
    throw new Error('Base API dédiée obligatoire.');
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [RestrictedController],
  })
    .overrideProvider(DatabaseService)
    .useFactory({
      factory: () =>
        new DatabaseService(new ConfigService<Environment, true>({ DATABASE_URL: apiUrl })),
    })
    .compile();
  app = module.createNestApplication();
  configureApp(app);
  await app.init();
  db = app.get(DatabaseService);
}, 120000);
afterAll(async () => {
  await app?.close();
});

describe('Initialisation administrateur par navigateur', () => {
  const registration = (suffix: string) => ({
    email: 'initial.' + suffix + '@example.test',
    firstName: 'Premier',
    lastName: 'Administrateur',
    password: secret,
    deviceId: randomUUID(),
    deviceLabel: 'Initialisation navigateur',
    website: '',
  });
  const create = (payload: object) =>
    request(app.getHttpServer())
      .post(path + 'auth/register-admin')
      .set('X-SUIVI-CLIENT', 'web')
      .send(payload);
  it('ouvre uniquement l’initialisation vide, sans mettre le statut en cache', async () => {
    const response = await request(app.getHttpServer())
      .get(path + 'auth/registration-status')
      .expect(200);
    expect(response.body.data).toEqual({ registrationOpen: true });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rejette le piège, les champs injectés, un e-mail ou un mot de passe invalide et le cross-site sans créer de compte', async () => {
    const value = registration(randomUUID());
    for (const payload of [
      { ...value, website: 'https://spam.example' },
      { ...value, website: null },
      { ...value, role: 'SUPER_ADMIN' },
      { ...value, email: 'invalide' },
      { ...value, password: 'court' },
      { ...value, firstName: '   ' },
    ])
      await create(payload).expect(400);
    await request(app.getHttpServer())
      .post(path + 'auth/register-admin')
      .set('X-SUIVI-CLIENT', 'web')
      .set('Origin', 'https://foreign.example')
      .send(value)
      .expect(403);
    expect(await db.prisma.user.count()).toBe(0);
  });
  it('crée un seul administrateur sous concurrence, avec hash, session et audit atomiques', async () => {
    const values = [registration(randomUUID()), registration(randomUUID())];
    const responses = await Promise.all(values.map((value) => create(value)));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const index = responses.findIndex((response) => response.status === 201);
    const response = responses[index]!;
    const row = await db.prisma.user.findUniqueOrThrow({
      where: { id: response.body.data.user.id },
    });
    expect(row.loginNormalized).toBe(values[index]!.email);
    expect(row.passwordHash).toMatch(/^\$argon2id/);
    expect(row.passwordHash).not.toBe(secret);
    expect(row.mustChangePassword).toBe(false);
    expect(row.initialPasswordExpiresAt).toBeNull();
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(cookieOf(response)).toMatch(/HttpOnly/);
    expect(await db.prisma.user.count({ where: { role: 'SUPER_ADMIN' } })).toBe(1);
    expect(await db.prisma.session.count({ where: { userId: row.id, revokedAt: null } })).toBe(1);
    expect(
      await db.prisma.auditLog.count({ where: { actorId: row.id, action: 'ADMIN_REGISTERED' } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .get(path + 'protected-test')
      .auth(response.body.data.accessToken, { type: 'bearer' })
      .expect(200);
  });
  it('ferme la création, même si l’administrateur initial est désactivé', async () => {
    const initial = await db.prisma.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN' } });
    await db.prisma.user.update({
      where: { id: initial.id },
      data: { status: 'INACTIVE', version: { increment: 1 } },
    });
    expect(
      (await request(app.getHttpServer()).get(path + 'auth/registration-status')).body.data
        .registrationOpen,
    ).toBe(false);
    await create(registration(randomUUID())).expect(409);
    expect(await db.prisma.user.count()).toBe(1);
  });
});

describe('Phase 4 — authentification HTTP avec PostgreSQL', () => {
  beforeAll(async () => {
    userId = (
      await db.prisma.user.create({
        data: {
          loginIdentifier: login,
          loginNormalized: login,
          firstName: 'Test',
          lastName: 'Authentification',
          role: 'SUPER_ADMIN',
          passwordHash: await hashInitialPassword(secret),
        },
      })
    ).id;
  });
  it('refuse les routes protégées sans JWT et les connexions invalides sans fuite', async () => {
    await request(app.getHttpServer())
      .get(path + 'protected-test')
      .expect(401);
    const response = await signIn('wrong-password').expect(401);
    expect(JSON.stringify(response.body)).not.toContain(login);
    await signIn('wrong-password', 'missing.' + randomUUID()).expect(401);
  });
  it('refuse le cross-site et les champs non prévus', async () => {
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .set('Origin', 'https://foreign.example')
      .send({ login, password: secret, deviceId, deviceLabel: 'Test' })
      .expect(403);
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({ login, password: secret, deviceId, deviceLabel: 'Test', role: 'SUPER_ADMIN' })
      .expect(400);
  });
  it('connecte mais bloque le métier tant que le secret initial reste actif', async () => {
    const response = await signIn().expect(200);
    token = response.body.data.accessToken;
    expect(response.body.data.user.mustChangePassword).toBe(true);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(cookieOf(response)).toMatch(/HttpOnly/);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const blocked = await request(app.getHttpServer())
      .get(path + 'protected-test')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
  it('change le secret, invalide l’ancien et révoque le JWT existant', async () => {
    await request(app.getHttpServer())
      .post(path + 'auth/change-password')
      .set('X-SUIVI-CLIENT', 'web')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: secret, newPassword: next })
      .expect(200);
    await signIn().expect(401);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(token, { type: 'bearer' })
      .expect(401);
    const knownDevice = await db.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const response = await signIn(next, login, 'Appareil renomme pour la recette').expect(200);
    const renamedDevice = await db.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(renamedDevice.label).toBe('Appareil renomme pour la recette');
    expect(renamedDevice.createdAt).toEqual(knownDevice.createdAt);
    expect(renamedDevice.userId).toBe(knownDevice.userId);
    expect(await db.prisma.device.count({ where: { userId } })).toBe(1);
    const renamedAudit = await db.prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: userId,
        deviceId,
        action: 'LOGIN_SUCCEEDED',
        afterValue: { path: ['deviceLabel'], equals: 'Appareil renomme pour la recette' },
      },
    });
    expect(renamedAudit.beforeValue).toEqual({ deviceLabel: 'Test navigateur' });
    token = response.body.data.accessToken;
    refreshCookie = cookieOf(response).split(';')[0]!;
    await request(app.getHttpServer())
      .get(path + 'protected-test')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });
  it('fait une rotation puis détecte la réutilisation du refresh et révoque la session', async () => {
    const rotated = await request(app.getHttpServer())
      .post(path + 'auth/refresh')
      .set('X-SUIVI-CLIENT', 'web')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(cookieOf(rotated)).not.toEqual(refreshCookie);
    await request(app.getHttpServer())
      .post(path + 'auth/refresh')
      .set('X-SUIVI-CLIENT', 'web')
      .set('Cookie', refreshCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(rotated.body.data.accessToken, { type: 'bearer' })
      .expect(401);
  });

  it('révoque l’ancien JWT et son refresh lorsqu’un autre appareil se connecte', async () => {
    const first = await signIn(next).expect(200);
    const replacement = await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({
        login,
        password: next,
        portal: 'SUPER_ADMIN',
        deviceId: randomUUID(),
        deviceLabel: 'Autre appareil',
        website: '',
      })
      .expect(200);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(first.body.data.accessToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post(path + 'auth/refresh')
      .set('X-SUIVI-CLIENT', 'web')
      .set('Cookie', cookieOf(first).split(';')[0]!)
      .expect(401);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(replacement.body.data.accessToken, { type: 'bearer' })
      .expect(200);
    expect(await db.prisma.session.count({ where: { userId, revokedAt: null } })).toBe(1);
    expect(
      await db.prisma.auditLog.count({
        where: { actorId: userId, action: 'PREVIOUS_SESSIONS_REVOKED' },
      }),
    ).toBeGreaterThan(0);
  });
  it('conserve une seule session sous deux connexions simultanées', async () => {
    const responses = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post(path + 'auth/login')
          .set('X-SUIVI-CLIENT', 'web')
          .send({ login, password: next, deviceId: randomUUID(), deviceLabel: 'Concurrence' })
          .expect(200),
      ),
    );
    const profiles = await Promise.all(
      responses.map((response) =>
        request(app.getHttpServer())
          .get(path + 'auth/profile')
          .auth(response.body.data.accessToken, { type: 'bearer' }),
      ),
    );
    expect(profiles.map((response) => response.status).sort()).toEqual([200, 401]);
    expect(await db.prisma.session.count({ where: { userId, revokedAt: null } })).toBe(1);
  });
  it('refuse un mauvais espace ou un piège rempli sans révoquer la session légitime', async () => {
    const first = await signIn(next).expect(200);
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({
        login,
        password: next,
        deviceId,
        deviceLabel: 'Test',
        portal: 'MANAGER',
        website: '',
      })
      .expect(401);
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({ login, password: next, deviceId, deviceLabel: 'Test', website: 'bot' })
      .expect(400);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(first.body.data.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('révoque à la déconnexion puis refuse un compte désactivé', async () => {
    const response = await signIn(next).expect(200);
    token = response.body.data.accessToken;
    await request(app.getHttpServer())
      .post(path + 'auth/logout')
      .set('X-SUIVI-CLIENT', 'web')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(path + 'auth/profile')
      .auth(token, { type: 'bearer' })
      .expect(401);
    await db.prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE', version: { increment: 1 } },
    });
    await signIn(next).expect(401);
  });
});

let deptA: string,
  deptB: string,
  managerA: string,
  managerTokenA: string,
  managerTokenB: string,
  memberA: string,
  memberB: string,
  objectiveId: string,
  weekId: string,
  paymentId: string,
  secondPaymentId: string;
const managerLoginA = 'responsable.a.' + randomUUID();
const managerLoginB = 'responsable.b.' + randomUUID();
const managerDeviceA = randomUUID(),
  managerDeviceB = randomUUID();
const managerSecret = randomBytes(24).toString('base64url');
const apiRequest = (method: 'get' | 'post' | 'patch', url: string, access = token) => {
  const call = request(app.getHttpServer());
  return call[method](path + url)
    .set('X-SUIVI-CLIENT', 'web')
    .auth(access, { type: 'bearer' });
};
const managerLogin = (identity: string, password: string, device: string) =>
  request(app.getHttpServer())
    .post(path + 'auth/login')
    .set('X-SUIVI-CLIENT', 'web')
    .send({ login: identity, password, deviceId: device, deviceLabel: 'Test métier' });

describe('Phase 5 — départements', () => {
  beforeAll(async () => {
    await db.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', version: { increment: 1 } },
    });
    token = (await signIn(next).expect(200)).body.data.accessToken;
  });
  it('crée et consulte deux départements, avec audit dans la transaction', async () => {
    const a = await apiRequest('post', 'departments')
      .send({ name: 'API Département A', description: 'Intégration', status: 'ACTIVE' })
      .expect(201);
    deptA = a.body.data.id;
    const b = await apiRequest('post', 'departments')
      .send({ name: 'API Département B', status: 'ACTIVE' })
      .expect(201);
    deptB = b.body.data.id;
    expect((await apiRequest('get', 'departments?q=API').expect(200)).body.data.total).toBe(2);
    expect(
      await db.prisma.auditLog.count({ where: { action: 'DEPARTMENT_CREATED', entityId: deptA } }),
    ).toBe(1);
  });
  it('modifie, désactive et réactive sans supprimer ; refuse une version périmée', async () => {
    await apiRequest('patch', 'departments/' + deptA)
      .send({ version: 1, status: 'INACTIVE' })
      .expect(200);
    await apiRequest('patch', 'departments/' + deptA)
      .send({ version: 1, name: 'Perdu' })
      .expect(409);
    await apiRequest('patch', 'departments/' + deptA)
      .send({ version: 2, status: 'ACTIVE' })
      .expect(200);
    expect((await apiRequest('get', 'departments/' + deptA)).body.data.version).toBe(3);
  });
});

describe('Phase 6 — responsables, remise et réinitialisation des accès', () => {
  it('génère deux secrets distincts non récupérables, et impose leur changement', async () => {
    const a = await apiRequest('post', 'managers')
      .send({
        login: managerLoginA,
        firstName: 'Responsable',
        lastName: 'A',
        departmentId: deptA,
        status: 'ACTIVE',
        initialValidityHours: 24,
      })
      .expect(201);
    managerA = a.body.data.user.id;
    const b = await apiRequest('post', 'managers')
      .send({
        login: managerLoginB,
        firstName: 'Responsable',
        lastName: 'B',
        departmentId: deptB,
        status: 'ACTIVE',
        initialValidityHours: 24,
      })
      .expect(201);
    expect(a.body.data.initialPassword).not.toBe(b.body.data.initialPassword);
    expect(
      (await apiRequest('get', 'managers/' + managerA).expect(200)).body.data.initialPassword,
    ).toBeUndefined();
    const firstA = await managerLogin(managerLoginA, a.body.data.initialPassword, managerDeviceA);
    const firstB = await managerLogin(managerLoginB, b.body.data.initialPassword, managerDeviceB);
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({
        login: managerLoginA,
        password: a.body.data.initialPassword,
        deviceId: managerDeviceA,
        deviceLabel: 'Mauvais espace',
        portal: 'SUPER_ADMIN',
        website: '',
      })
      .expect(401);
    await apiRequest('get', 'members', firstA.body.data.accessToken).expect(403);
    for (const response of [firstA, firstB])
      await apiRequest('post', 'auth/change-password', response.body.data.accessToken)
        .send({
          currentPassword:
            response === firstA ? a.body.data.initialPassword : b.body.data.initialPassword,
          newPassword: managerSecret,
        })
        .expect(200);
    managerTokenA = (await managerLogin(managerLoginA, managerSecret, managerDeviceA).expect(200))
      .body.data.accessToken;
    managerTokenB = (await managerLogin(managerLoginB, managerSecret, managerDeviceB).expect(200))
      .body.data.accessToken;
  });
  it('interdit un deuxième responsable actif et les fonctions administrateur aux responsables', async () => {
    await apiRequest('post', 'managers')
      .send({
        login: 'duplicate.' + randomUUID(),
        firstName: 'Test',
        lastName: 'Test',
        departmentId: deptA,
        status: 'ACTIVE',
        initialValidityHours: 24,
      })
      .expect(409);
    await apiRequest('get', 'managers', managerTokenA).expect(403);
    await apiRequest('post', 'departments', managerTokenA)
      .send({ name: 'Interdit', status: 'ACTIVE' })
      .expect(403);
    await apiRequest('get', 'departments/' + deptB, managerTokenA).expect(403);
    expect(
      (await apiRequest('get', 'departments', managerTokenA)).body.data.items.map(
        (d: { id: string }) => d.id,
      ),
    ).toEqual([deptA]);
  });
  it('réinitialise et révoque immédiatement les anciennes sessions', async () => {
    const before = (await apiRequest('get', 'managers/' + managerA)).body.data;
    const reset = await apiRequest('post', 'managers/' + managerA + '/reset-password')
      .send({
        version: before.version,
        initialValidityHours: 24,
        reason: 'Test de récupération supervisée',
      })
      .expect(201);
    await apiRequest('get', 'auth/profile', managerTokenA).expect(401);
    await managerLogin(managerLoginA, managerSecret, managerDeviceA).expect(401);
    const initial = await managerLogin(
      managerLoginA,
      reset.body.data.initialPassword,
      managerDeviceA,
    ).expect(200);
    await apiRequest('post', 'auth/change-password', initial.body.data.accessToken)
      .send({ currentPassword: reset.body.data.initialPassword, newPassword: managerSecret })
      .expect(200);
    managerTokenA = (await managerLogin(managerLoginA, managerSecret, managerDeviceA).expect(200))
      .body.data.accessToken;
    const stored = await db.prisma.user.findUniqueOrThrow({ where: { id: managerA } });
    expect(stored.passwordHash).toMatch(/^\$argon2id/);
  });
});

describe('Phase 7 — membres et isolation', () => {
  it('crée les membres dans leur seul département et garantit le numéro unique', async () => {
    const a = await apiRequest('post', 'members', managerTokenA)
      .send({
        memberNumber: 'API-A',
        firstName: 'Awa',
        lastName: 'Test',
        contact: 'Contact A',
        neighborhood: 'Quartier A',
        departmentId: deptA,
      })
      .expect(201);
    memberA = a.body.data.id;
    memberB = (
      await apiRequest('post', 'members', managerTokenB)
        .send({ memberNumber: 'API-B', firstName: 'Binta', lastName: 'Test', departmentId: deptB })
        .expect(201)
    ).body.data.id;
    await apiRequest('post', 'members', managerTokenA)
      .send({ memberNumber: 'API-A', firstName: 'Doublon', lastName: 'Test', departmentId: deptA })
      .expect(409);
    await apiRequest('post', 'members', managerTokenA)
      .send({ memberNumber: 'INTERDIT', firstName: 'Autre', lastName: 'Test', departmentId: deptB })
      .expect(403);
  });
  it('recherche le nom complet dans les deux sens sans sortir du département autorisé', async () => {
    for (const search of ['awa test', 'Test   AWA', 'API-A', 'Contact A']) {
      const result = (
        await apiRequest('get', 'members?q=' + encodeURIComponent(search), managerTokenA).expect(
          200,
        )
      ).body.data;
      expect(result.total).toBe(1);
      expect(result.items.map((row: { id: string }) => row.id)).toEqual([memberA]);
    }
    const foreign = (await apiRequest('get', 'members?q=Binta%20Test', managerTokenA).expect(200))
      .body.data;
    expect(foreign.total).toBe(0);
    const own = (await apiRequest('get', 'members?q=Binta%20Test', managerTokenB).expect(200)).body
      .data;
    expect(own.items.map((row: { id: string }) => row.id)).toEqual([memberB]);
  });
  it('refuse les identifiants étrangers dans les URL, filtres et corps', async () => {
    await apiRequest('get', 'members/' + memberB, managerTokenA).expect(404);
    await apiRequest('get', 'members?departmentId=' + deptB, managerTokenA).expect(403);
    await apiRequest('patch', 'members/' + memberB, managerTokenA)
      .send({ version: 1, firstName: 'Intrusion' })
      .expect(404);
    await apiRequest('patch', 'members/' + memberA, managerTokenA)
      .send({ version: 1, departmentId: deptB })
      .expect(400);
    const rows = (await apiRequest('get', 'members', managerTokenA).expect(200)).body.data.items;
    expect(rows.map((row: { id: string }) => row.id)).toEqual([memberA]);
  });
  it('versionne, archive, réactive par administrateur et trace chaque changement', async () => {
    await apiRequest('patch', 'members/' + memberA, managerTokenA)
      .send({ version: 1, neighborhood: 'Quartier corrigé' })
      .expect(200);
    await apiRequest('patch', 'members/' + memberA, managerTokenA)
      .send({ version: 1, firstName: 'Modification perdue' })
      .expect(409);
    await apiRequest('patch', 'members/' + memberA + '/archive', managerTokenA)
      .send({ version: 2, reason: 'Départ temporaire' })
      .expect(200);
    await apiRequest('patch', 'members/' + memberA + '/reactivate')
      .send({ version: 3, reason: 'Retour confirmé' })
      .expect(200);
    expect(
      await db.prisma.auditLog.count({ where: { entityId: memberA, entityType: 'Member' } }),
    ).toBe(4);
  });
});

describe('Phase 8 — encaissements transactionnels', () => {
  beforeAll(async () => {
    // Dépendance nécessaire aux paiements : campagne réelle de test créée via API, jamais dans suivi_dev.
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 364 * 86400000).toISOString().slice(0, 10);
    const campaign = await apiRequest('post', 'objectives')
      .send({
        name: 'API Campagne de test',
        targetAmount: '10000',
        startsOn: start,
        endsOn: end,
        timezone: 'UTC',
        calendar: 'SUNDAY_SATURDAY',
        status: 'ACTIVE',
      })
      .expect(201);
    objectiveId = campaign.body.data.id;
    weekId = campaign.body.data.weeks[0].id;
  });
  const payload = (amount = '4000') => ({
    memberId: memberA,
    collectionWeekId: weekId,
    idempotencyKey: randomUUID(),
    amount,
    method: 'TEST_CASH',
    collectedAt: new Date().toISOString(),
  });
  it('crée plusieurs versements et renvoie une seule transaction sous concurrence/idempotence', async () => {
    const value = payload();
    const responses = await Promise.all([
      apiRequest('post', 'payments', managerTokenA).send(value).expect(201),
      apiRequest('post', 'payments', managerTokenA).send(value).expect(201),
    ]);
    paymentId = responses[0]!.body.data.id;
    expect(responses[1]!.body.data.id).toBe(paymentId);
    expect(await db.prisma.payment.count({ where: { idempotencyKey: value.idempotencyKey } })).toBe(
      1,
    );
    await apiRequest('post', 'payments', managerTokenA)
      .send({ ...value, amount: '5000' })
      .expect(409);
    secondPaymentId = (
      await apiRequest('post', 'payments', managerTokenA).send(payload('6000')).expect(201)
    ).body.data.id;
    expect((await apiRequest('get', 'members', managerTokenA)).body.data.items[0].totalAmount).toBe(
      '10000',
    );
    expect(
      (await apiRequest('get', 'objectives/' + objectiveId + '/progress')).body.data.percentage,
    ).toBe('100.00');
  });
  it('dépasse l’objectif unique sans le multiplier par les départements', async () => {
    await apiRequest('post', 'payments', managerTokenA).send(payload('5000')).expect(201);
    const progress = (await apiRequest('get', 'objectives/' + objectiveId + '/progress')).body.data;
    expect(progress).toEqual({
      targetAmount: '10000',
      totalAmount: '15000',
      remainingAmount: '0',
      exceededAmount: '5000',
      percentage: '150.00',
    });
  });
  it('refuse montants invalides, périmètres étrangers, date future et fonction administrateur', async () => {
    for (const amount of ['0', '-1', '1.5', '9223372036854775808'])
      await apiRequest('post', 'payments', managerTokenA).send(payload(amount)).expect(400);
    await apiRequest('post', 'payments', managerTokenB).send(payload()).expect(404);
    await apiRequest('get', 'payments/' + paymentId, managerTokenB).expect(404);
    await apiRequest('post', 'payments', managerTokenA)
      .send({ ...payload(), collectedAt: new Date(Date.now() + 86400000).toISOString() })
      .expect(400);
    await apiRequest('post', 'payments').send(payload()).expect(403);
    await apiRequest('post', 'payments/' + paymentId + '/cancellations', managerTokenA)
      .send({ version: 1, reason: 'Interdit' })
      .expect(403);
  });
  it('corrige puis annule avec justification, solde calculé et original intact', async () => {
    await apiRequest('post', 'payments/' + paymentId + '/revisions')
      .send({ version: 1, amount: '3000', reason: 'Correction du reçu vérifiée' })
      .expect(201);
    await apiRequest('post', 'payments/' + paymentId + '/revisions')
      .send({ version: 1, amount: '2000', reason: 'Version périmée' })
      .expect(409);
    await apiRequest('post', 'payments/' + secondPaymentId + '/cancellations')
      .send({ version: 1, reason: 'Annulation justifiée' })
      .expect(201);
    const cancelled = await db.prisma.payment.findUniqueOrThrow({ where: { id: secondPaymentId } });
    const replay = await apiRequest('post', 'payments', managerTokenA)
      .send({
        memberId: cancelled.memberId,
        collectionWeekId: cancelled.collectionWeekId,
        idempotencyKey: cancelled.idempotencyKey,
        amount: cancelled.originalAmount.toString(),
        method: cancelled.method,
        reference: cancelled.reference ?? '',
        collectedAt: cancelled.collectedAt.toISOString(),
      })
      .expect(201);
    expect(replay.body.data.status).toBe('CANCELLED');
    expect(replay.body.data.amount).toBe('0');
    expect(replay.body.data.id).toBe(secondPaymentId);
    expect(
      (await apiRequest('get', 'objectives/' + objectiveId + '/progress')).body.data.totalAmount,
    ).toBe('8000');
    const original = await db.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(original.originalAmount).toBe(4000n);
    expect(
      await db.prisma.auditLog.count({
        where: { action: { in: ['PAYMENT_CORRECTED', 'PAYMENT_CANCELLED'] }, actorId: userId },
      }),
    ).toBe(2);
    await apiRequest('post', 'payments/' + paymentId + '/revisions')
      .send({ version: 2, amount: '2000', reason: '' })
      .expect(400);
  });
  it('conserve exactement un montant au-delà de Number.MAX_SAFE_INTEGER', async () => {
    const p = await apiRequest('post', 'payments', managerTokenA)
      .send(payload('9007199254740993'))
      .expect(201);
    expect(p.body.data.amount).toBe('9007199254740993');
    await apiRequest('post', 'payments/' + p.body.data.id + '/cancellations')
      .send({ version: 1, reason: 'Fin de vérification de précision' })
      .expect(201);
  });
  it('bloque un membre archivé et conserve les paiements historiques après transfert', async () => {
    await apiRequest('patch', 'members/' + memberA + '/archive', managerTokenA)
      .send({ version: 4, reason: 'Test archivage' })
      .expect(200);
    await apiRequest('post', 'payments', managerTokenA).send(payload()).expect(409);
    await apiRequest('patch', 'members/' + memberA + '/reactivate')
      .send({ version: 5, reason: 'Reprise de la collecte' })
      .expect(200);
    await apiRequest('post', 'members/' + memberA + '/transfer')
      .send({ version: 6, departmentId: deptB, reason: 'Transfert autorisé' })
      .expect(201);
    await apiRequest('get', 'members/' + memberA, managerTokenA).expect(404);
    const historical = await apiRequest('get', 'payments/' + paymentId, managerTokenA).expect(200);
    expect(historical.body.data.departmentId).toBe(deptA);
    const b = (await apiRequest('get', 'members', managerTokenB)).body.data.items.find(
      (row: { id: string }) => row.id === memberA,
    );
    expect(b.totalAmount).toBe('0');
  });
});

describe('Phase 9 — objectifs et tableaux de bord', () => {
  it('protège les objectifs et les détails des autres départements', async () => {
    const weeks = await apiRequest(
      'get',
      'collection-weeks?objectiveId=' + objectiveId + '&pageSize=2',
      managerTokenA,
    ).expect(200);
    expect(weeks.body.data.items).toHaveLength(2);
    expect(weeks.body.data.total).toBeGreaterThan(50);
    await apiRequest('get', 'collection-weeks', managerTokenA).expect(400);
    await apiRequest('patch', 'objectives/' + objectiveId)
      .send({ version: 1, targetAmount: null, reason: 'Entrée invalide' })
      .expect(400);
    await apiRequest('patch', 'objectives/' + objectiveId, managerTokenA)
      .send({ version: 1, targetAmount: '1', reason: 'Interdit' })
      .expect(403);
    const dashboard = (await apiRequest('get', 'dashboard', managerTokenA).expect(200)).body.data;
    expect(dashboard.departments.map((d: { id: string }) => d.id)).toEqual([deptA]);
    expect(dashboard.departmentTotal).toBe('8000');
    expect(dashboard.progress.totalAmount).toBe('8000');
    expect(
      dashboard.recentPayments.every((p: { departmentId: string }) => p.departmentId === deptA),
    ).toBe(true);
    const admin = (await apiRequest('get', 'dashboard').expect(200)).body.data;
    expect(admin.departments).toHaveLength(2);
    expect(admin.counts.activeMembers).toBe(2);
  });
  it('agrège les semaines avec montants exacts et isole les contributions de chaque département', async () => {
    const a = (await apiRequest('get', 'dashboard', managerTokenA).expect(200)).body.data;
    const b = (await apiRequest('get', 'dashboard', managerTokenB).expect(200)).body.data;
    const admin = (await apiRequest('get', 'dashboard').expect(200)).body.data;
    const total = (rows: { totalAmount: string }[]) =>
      rows.reduce((sum, row) => sum + BigInt(row.totalAmount), 0n);
    expect(a.weeklyCollections.length).toBeGreaterThan(50);
    expect(a.weeklyCollections.find((row: { id: string }) => row.id === weekId).totalAmount).toBe(
      '8000',
    );
    expect(total(a.weeklyCollections)).toBe(8000n);
    expect(total(b.weeklyCollections)).toBe(0n);
    expect(total(admin.weeklyCollections)).toBe(BigInt(admin.departmentTotal));
    expect(
      a.weeklyCollections.every(
        (row: { number: number; startsOn: string; totalAmount: string }, index: number) =>
          row.number === index + 1 &&
          /^\d{4}-\d{2}-\d{2}T/.test(row.startsOn) &&
          /^\d+$/.test(row.totalAmount),
      ),
    ).toBe(true);
  });
  it('refuse une deuxième campagne active et suspend/reprend sans perte', async () => {
    const objective = (await apiRequest('get', 'objectives/' + objectiveId)).body.data;
    await apiRequest('post', 'objectives')
      .send({
        name: 'Concurrence',
        targetAmount: '10',
        startsOn: objective.startsOn.slice(0, 10),
        endsOn: objective.endsOn.slice(0, 10),
        timezone: 'UTC',
        calendar: 'SUNDAY_SATURDAY',
        status: 'ACTIVE',
      })
      .expect(409);
    await apiRequest('patch', 'objectives/' + objectiveId)
      .send({ version: 1, status: 'SUSPENDED', reason: 'Vérification temporaire' })
      .expect(200);
    await apiRequest('patch', 'objectives/' + objectiveId)
      .send({ version: 2, status: 'ACTIVE', reason: 'Reprise autorisée' })
      .expect(200);
    expect(
      (await apiRequest('get', 'objectives/' + objectiveId + '/progress')).body.data.totalAmount,
    ).toBe('8000');
  });
  it('clôture en conservant les semaines et le bilan historique', async () => {
    await apiRequest('patch', 'objectives/' + objectiveId)
      .send({ version: 3, status: 'CLOSED', reason: 'Clôture de la recette' })
      .expect(200);
    const row = (await apiRequest('get', 'objectives/' + objectiveId)).body.data;
    expect(row.weeks.length).toBeGreaterThan(50);
    expect(row.weeks.every((w: { status: string }) => w.status === 'CLOSED')).toBe(true);
    expect(
      (await apiRequest('get', 'dashboard?objectiveId=' + objectiveId)).body.data.progress
        .totalAmount,
    ).toBe('8000');
    await apiRequest('patch', 'objectives/' + objectiveId)
      .send({ version: 4, status: 'ACTIVE', reason: 'Réouverture non autorisée' })
      .expect(409);
  });
});

describe('Régressions de sécurité et de validation', () => {
  it('refuse les propriétés nulles et les mots de passe initiaux expirés', async () => {
    await apiRequest('patch', 'members/' + memberB, managerTokenB)
      .send({ version: 1, firstName: null })
      .expect(400);
    const expiredLogin = 'expired.' + randomUUID();
    await db.prisma.user.create({
      data: {
        loginIdentifier: expiredLogin,
        loginNormalized: expiredLogin,
        firstName: 'Expiration',
        lastName: 'Test',
        role: 'SUPER_ADMIN',
        passwordHash: await hashInitialPassword(secret),
        initialPasswordExpiresAt: new Date(Date.now() - 60000),
      },
    });
    await signIn(secret, expiredLogin).expect(401);
  });
  it('bloque les nouvelles écritures administratives et les sessions d’un département désactivé', async () => {
    const department = (await apiRequest('get', 'departments/' + deptB)).body.data;
    await apiRequest('patch', 'departments/' + deptB)
      .send({ version: department.version, status: 'INACTIVE' })
      .expect(200);
    await apiRequest('get', 'members', managerTokenB).expect(401);
    await apiRequest('post', 'members')
      .send({
        memberNumber: 'INACTIVE-' + randomUUID(),
        firstName: 'Refus',
        lastName: 'Test',
        departmentId: deptB,
      })
      .expect(409);
    await apiRequest('patch', 'departments/' + deptB)
      .send({ version: department.version + 1, status: 'ACTIVE' })
      .expect(200);
    await apiRequest('get', 'members', managerTokenB).expect(200);
  });
  it('refuse les nouveaux paiements dans une campagne clôturée', async () => {
    await apiRequest('post', 'payments', managerTokenB)
      .send({
        memberId: memberB,
        collectionWeekId: weekId,
        idempotencyKey: randomUUID(),
        amount: '1000',
        method: 'TEST_CASH',
        collectedAt: new Date().toISOString(),
      })
      .expect(409);
    expect(
      (await apiRequest('get', 'objectives/' + objectiveId + '/progress')).body.data.totalAmount,
    ).toBe('8000');
  });
  it('refuse le rejeu et les anciens détails après réaffectation du responsable', async () => {
    const department = (
      await apiRequest('post', 'departments')
        .send({ name: 'API Réaffectation', status: 'ACTIVE' })
        .expect(201)
    ).body.data;
    const before = (await apiRequest('get', 'managers/' + managerA)).body.data;
    await apiRequest('patch', 'managers/' + managerA)
      .send({
        version: before.version,
        departmentId: department.id,
        reason: 'Réaffectation administrative contrôlée',
      })
      .expect(200);
    await apiRequest('get', 'auth/profile', managerTokenA).expect(401);
    managerTokenA = (await managerLogin(managerLoginA, managerSecret, managerDeviceA).expect(200))
      .body.data.accessToken;
    await apiRequest('get', 'payments/' + paymentId, managerTokenA).expect(404);
    const historical = await db.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await apiRequest('post', 'payments', managerTokenA)
      .send({
        memberId: historical.memberId,
        collectionWeekId: historical.collectionWeekId,
        idempotencyKey: historical.idempotencyKey,
        amount: historical.originalAmount.toString(),
        method: historical.method,
        reference: historical.reference ?? '',
        collectedAt: historical.collectedAt.toISOString(),
      })
      .expect(409);
    expect((await apiRequest('get', 'payments', managerTokenA)).body.data.total).toBe(0);
  });
  it('respecte le propriétaire de l’appareil et la révocation immédiate d’un appareil', async () => {
    await request(app.getHttpServer())
      .post(path + 'auth/login')
      .set('X-SUIVI-CLIENT', 'web')
      .send({ login, password: next, deviceId: managerDeviceA, deviceLabel: 'Intrusion refusée' })
      .expect(401);
    await db.prisma.device.update({
      where: { id: managerDeviceB },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await apiRequest('get', 'auth/profile', managerTokenB).expect(401);
    await managerLogin(managerLoginB, managerSecret, managerDeviceB).expect(401);
  });
  it('limite les essais d’un identifiant sans divulguer cet identifiant dans l’erreur', async () => {
    const unknown = 'rate.' + randomUUID();
    for (let i = 0; i < 10; i++) await signIn('wrong', unknown).expect(401);
    const response = await signIn('wrong', unknown).expect(429);
    expect(response.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(JSON.stringify(response.body)).not.toContain(unknown);
  });
});
