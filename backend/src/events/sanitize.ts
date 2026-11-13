import type { Prisma } from '../generated/prisma/client.js';

const sensitive = /password|secret|token|authorization|cookie|credentialhash/i;
/** Les audits exposent les valeurs métier pertinentes, jamais les secrets d'authentification. */
export function auditValues(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (key, entry: unknown) =>
      sensitive.test(key) ? undefined : typeof entry === 'bigint' ? entry.toString() : entry,
    ),
  ) as Prisma.InputJsonValue;
}
