import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/auth.types.js';
import { BusinessService, paginate } from '../common/business.service.js';
import type { NotificationsQuery } from './notifications.dto.js';

const selection = {
  id: true,
  departmentId: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  readAt: true,
} as const;
@Injectable()
export class NotificationsService {
  constructor(private readonly business: BusinessService) {}
  private scope(actor: Principal, requested?: string): Prisma.NotificationWhereInput {
    const departmentId = this.business.scope(actor, requested);
    return {
      recipientId: actor.id,
      ...(actor.role === 'MANAGER'
        ? { OR: [{ departmentId: departmentId! }, { departmentId: null }] }
        : departmentId
          ? { departmentId }
          : {}),
    };
  }
  async list(actor: Principal, query: NotificationsQuery) {
    const where: Prisma.NotificationWhereInput = {
      AND: [
        this.scope(actor, query.departmentId),
        ...(query.q
          ? [
              {
                OR: [
                  { title: { contains: query.q, mode: 'insensitive' as const } },
                  { message: { contains: query.q, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
      ...(query.type ? { type: query.type } : {}),
      ...(query.readState === 'UNREAD'
        ? { readAt: null }
        : query.readState === 'READ'
          ? { readAt: { not: null } }
          : {}),
    };
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const items = await tx.notification.findMany({
          where,
          select: selection,
          ...paginate(query),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const total = await tx.notification.count({ where });
        return { items, total, page: query.page, pageSize: query.pageSize };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async count(actor: Principal, departmentId?: string) {
    return {
      unread: await this.business.db.prisma.notification.count({
        where: { AND: [this.scope(actor, departmentId)], readAt: null },
      }),
    };
  }
  async get(actor: Principal, id: string) {
    const item = await this.business.db.prisma.notification.findFirst({
      where: { AND: [this.scope(actor), { id }] },
      select: selection,
    });
    if (!item) throw new NotFoundException();
    return item;
  }
  private sqlScope(actor: Principal) {
    return actor.role === 'MANAGER'
      ? Prisma.sql`AND (department_id=${actor.departmentId}::uuid OR department_id IS NULL)`
      : Prisma.empty;
  }
  async read(actor: Principal, id?: string) {
    return this.business.transaction(actor, async (tx) => {
      if (
        id &&
        !(await tx.notification.findFirst({
          where: { AND: [this.scope(actor), { id }] },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      const updated = await tx.$executeRaw(
        Prisma.sql`UPDATE notifications SET read_at=clock_timestamp() WHERE recipient_id=${actor.id}::uuid AND read_at IS NULL ${this.sqlScope(actor)} ${id ? Prisma.sql`AND id=${id}::uuid` : Prisma.empty}`,
      );
      if (!id) return { updated };
      return tx.notification.findUniqueOrThrow({ where: { id }, select: selection });
    });
  }
}
