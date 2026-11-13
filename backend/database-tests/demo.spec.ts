import { randomBytes } from 'node:crypto';
import { createPrismaClient } from '../src/database/prisma-client.js';
import { seedDemo } from '../src/database/seeding.js';
import { assertDemoTarget } from '../src/database/seed-policy.js';
import { verifyPasswordHash } from '../src/common/passwords.js';

const url = process.env.SUIVI_TEST_DEMO_DATABASE_URL;
if (!url) throw new Error('Base de démonstration de test manquante.');
assertDemoTarget(url, 'test', 'true');
const client = createPrismaClient(url);
const password = randomBytes(32).toString('base64url');
afterAll(async () => {
  await client.$disconnect();
});

it('isole et initialise une démonstration complète sans doublons au second passage', async () => {
  await seedDemo(client, password, 'database-test');
  expect(await client.department.count()).toBe(2);
  expect(await client.member.count()).toBe(4);
  expect(await client.payment.count()).toBe(4);
  expect(await client.collectionWeek.count()).toBe(53);
  expect(await client.auditLog.count({ where: { action: 'PAYMENT_CREATED' } })).toBe(4);
  const admin = await client.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN' } });
  expect(await verifyPasswordHash(admin.passwordHash, password)).toBe(true);
  for (const manager of await client.user.findMany({ where: { role: 'MANAGER' } })) {
    expect(await verifyPasswordHash(manager.passwordHash, password)).toBe(false);
  }
  await seedDemo(client, password, 'database-test-repeat');
  expect(await client.payment.count()).toBe(4);
  expect(await client.user.count()).toBe(3);
}, 30000);

it('refuse les cibles normales et toute démonstration en production', () => {
  expect(() =>
    assertDemoTarget('postgresql://local@127.0.0.1/suivi_dev', 'development', 'true'),
  ).toThrow();
  expect(() => assertDemoTarget(url, 'production', 'true')).toThrow();
  expect(() => assertDemoTarget(url, 'test', 'false')).toThrow();
});
