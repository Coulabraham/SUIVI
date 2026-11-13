import { randomBytes, randomUUID } from 'node:crypto';
import { hashInitialPassword } from '../common/passwords.js';
import { sundayCalendar } from '../collection-weeks/calendar.js';
import { assertDemoDatabaseName } from './seed-policy.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export interface BootstrapInput {
  login: string;
  firstName: string;
  lastName: string;
  password: string;
  initialValidityHours?: number;
}

export async function bootstrapAdministrator(
  client: PrismaClient,
  input: BootstrapInput,
): Promise<string> {
  const login = input.login.trim();
  if (!login || !input.firstName.trim() || !input.lastName.trim()) {
    throw new Error('Identifiant, prénom et nom de l’administrateur sont obligatoires.');
  }
  const passwordHash = await hashInitialPassword(input.password);
  if (
    input.initialValidityHours !== undefined &&
    (!Number.isInteger(input.initialValidityHours) ||
      input.initialValidityHours < 1 ||
      input.initialValidityHours > 168)
  )
    throw new Error('Validité du secret initial invalide.');
  return client.$transaction(async (tx) => {
    // Empêche deux bootstraps simultanés, sans identité universelle ni reset implicite.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(726384901)`;
    if (await tx.user.count({ where: { role: 'SUPER_ADMIN' } })) {
      throw new Error('Un Super Administrateur existe déjà ; le bootstrap ne modifie aucun accès.');
    }
    const user = await tx.user.create({
      data: {
        loginIdentifier: login,
        loginNormalized: login.normalize('NFKC').toLocaleLowerCase('en-US'),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        passwordHash,
        role: 'SUPER_ADMIN',
        mustChangePassword: true,
        initialPasswordExpiresAt:
          input.initialValidityHours === undefined
            ? null
            : new Date(Date.now() + input.initialValidityHours * 3600000),
      },
    });
    await tx.syncScope.createMany({ data: [{ key: 'GLOBAL' }], skipDuplicates: true });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_BOOTSTRAPPED',
        entityType: 'User',
        entityId: user.id,
        afterValue: { loginIdentifier: login },
        outcome: 'SUCCESS',
        requestId: randomUUID(),
      },
    });
    return user.id;
  });
}

export async function seedDemo(
  client: PrismaClient,
  password: string,
  marker: string,
): Promise<void> {
  const databases = await client.$queryRaw<
    { name: string }[]
  >`SELECT current_database()::text AS name`;
  assertDemoDatabaseName(databases[0]?.name ?? '', process.env.NODE_ENV);
  const passwordHash = await hashInitialPassword(password);
  await client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726384902)`;
      const existing = await tx.auditLog.findFirst({
        where: { action: 'DEMO_SEEDED', entityType: 'DemoDataset' },
      });
      if (existing) return;
      if (await tx.user.count())
        throw new Error('Le jeu de démonstration exige une base métier vide.');
      const admin = await tx.user.create({
        data: {
          loginIdentifier: 'demo.admin',
          loginNormalized: 'demo.admin',
          firstName: 'Démo',
          lastName: 'Administration',
          passwordHash,
          role: 'SUPER_ADMIN',
        },
      });
      const objective = await tx.objective.create({
        data: {
          name: 'DÉMONSTRATION — campagne 2026',
          targetAmount: 10000000n,
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
          timezone: 'Africa/Abidjan',
          status: 'ACTIVE',
          createdById: admin.id,
        },
      });
      const weeks = sundayCalendar('2026-01-01', '2026-12-31');
      await tx.collectionWeek.createMany({
        data: weeks.map((week) => ({ ...week, objectiveId: objective.id })),
      });
      const week = await tx.collectionWeek.findFirstOrThrow({
        where: { objectiveId: objective.id, startsOn: new Date('2026-11-08') },
      });
      for (const [index, name] of ['Département Démo A', 'Département Démo B'].entries()) {
        const department = await tx.department.create({ data: { name, status: 'ACTIVE' } });
        const manager = await tx.user.create({
          data: {
            loginIdentifier: `demo.responsable.${index + 1}`,
            loginNormalized: `demo.responsable.${index + 1}`,
            firstName: 'Démo',
            lastName: `Responsable ${index + 1}`,
            role: 'MANAGER',
            departmentId: department.id,
            passwordHash: await hashInitialPassword(randomBytes(32).toString('base64url')),
          },
        });
        const device = await tx.device.create({
          data: { userId: manager.id, label: 'Appareil de démonstration' },
        });
        await tx.syncScope.create({
          data: { key: `DEPARTMENT:${department.id}`, departmentId: department.id },
        });
        for (let number = 1; number <= 2; number++) {
          const member = await tx.member.create({
            data: {
              memberNumber: `DEMO-${index + 1}-${number}`,
              firstName: 'Membre Démo',
              lastName: `${index + 1}.${number}`,
              departmentId: department.id,
              registeredAt: new Date('2026-01-01'),
            },
          });
          const period = await tx.memberDepartmentPeriod.create({
            data: {
              memberId: member.id,
              departmentId: department.id,
              startsAt: new Date('2026-01-01'),
              createdById: admin.id,
            },
          });
          const payment = await tx.payment.create({
            data: {
              memberId: member.id,
              departmentId: department.id,
              affiliationId: period.id,
              collectedById: manager.id,
              objectiveId: objective.id,
              collectionWeekId: week.id,
              originalAmount: BigInt(number) * 5000n,
              method: 'DEMO_CASH',
              collectedAt: new Date('2026-11-08T10:00:00Z'),
              idempotencyKey: randomUUID(),
              originDeviceId: device.id,
              memberLabelSnapshot: `${member.firstName} ${member.lastName}`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: manager.id,
              actorRole: 'MANAGER',
              departmentId: department.id,
              action: 'PAYMENT_CREATED',
              entityType: 'Payment',
              entityId: payment.id,
              afterValue: { amount: payment.originalAmount.toString() },
              outcome: 'SUCCESS',
              requestId: randomUUID(),
            },
          });
        }
      }
      await tx.syncScope.createMany({ data: [{ key: 'GLOBAL' }], skipDuplicates: true });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorRole: 'SUPER_ADMIN',
          action: 'DEMO_SEEDED',
          entityType: 'DemoDataset',
          afterValue: { marker, demonstrationOnly: true },
          outcome: 'SUCCESS',
          requestId: randomUUID(),
        },
      });
    },
    { timeout: 30000 },
  );
}
