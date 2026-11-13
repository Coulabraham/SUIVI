import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import { transactionOptions } from '../database/transaction-options.js';
import { AuthService } from '../auth/auth.service.js';
import type { Principal } from '../auth/auth.types.js';
import { EventRecorder } from '../events/event-recorder.js';

export type Transaction = Prisma.TransactionClient;
export const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
export const paginate = (query: { page: number; pageSize: number }) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});
export const checkVersion = (actual: number, expected: number) => {
  if (actual !== expected)
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: 'Ces données ont changé. Actualisez la page avant de réessayer.',
    });
};
export const requireAdmin = (actor: Principal) => {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException();
};

@Injectable()
export class BusinessService {
  constructor(
    readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly events: EventRecorder,
  ) {}
  scope(actor: Principal, requested?: string) {
    if (actor.role === 'MANAGER') {
      if (!actor.departmentId || (requested && requested !== actor.departmentId))
        throw new ForbiddenException();
      return actor.departmentId;
    }
    return requested;
  }
  async transaction<T>(actor: Principal, callback: (tx: Transaction) => Promise<T>) {
    return this.db.prisma.$transaction(async (tx) => {
      await this.auth.lockIdentity(tx, actor);
      return callback(tx);
    }, transactionOptions);
  }
  async activeDepartment(tx: Transaction, id: string) {
    await tx.$queryRaw`SELECT id FROM departments WHERE id=${id}::uuid FOR SHARE`;
    const row = await tx.department.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.status !== 'ACTIVE')
      throw new ConflictException({
        code: 'DEPARTMENT_INACTIVE',
        message: 'Ce département est désactivé. Réactivez-le avant une nouvelle opération.',
      });
    return row;
  }
  async audit(
    tx: Transaction,
    actor: Principal,
    requestId: string,
    action: string,
    entityType: string,
    entityId: string,
    departmentId: string | null,
    before?: unknown,
    after?: unknown,
  ) {
    await this.events.record(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      deviceId: actor.deviceId,
      requestId,
      action,
      entityType,
      entityId,
      departmentId,
      outcome: 'SUCCESS',
      ...(before === undefined ? {} : { beforeValue: jsonValue(before) }),
      ...(after === undefined ? {} : { afterValue: jsonValue(after) }),
    });
  }
}
