import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/auth.types.js';
import { BusinessService, paginate, requireAdmin } from '../common/business.service.js';
import { auditValues } from '../events/sanitize.js';
import type { AuditQuery } from './audit.dto.js';
const select = {
  id: true,
  actorId: true,
  actorRole: true,
  departmentId: true,
  action: true,
  entityType: true,
  entityId: true,
  occurredAt: true,
  outcome: true,
  deviceId: true,
  requestId: true,
  actor: { select: { firstName: true, lastName: true } },
  department: { select: { name: true } },
  device: { select: { label: true } },
} as const;
type Row = Prisma.AuditLogGetPayload<{ select: typeof select }>;
const view = ({ actor, department, device, ...record }: Row) => ({
  ...record,
  actorName: actor ? actor.firstName + ' ' + actor.lastName : null,
  departmentName: department?.name ?? null,
  deviceLabel: device?.label ?? null,
});
@Injectable()
export class AuditService {
  constructor(private readonly business: BusinessService) {}
  async list(actor: Principal, query: AuditQuery) {
    requireAdmin(actor);
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException({
        code: 'INVALID_AUDIT_PERIOD',
        message: 'La date de début doit précéder la date de fin.',
      });
    const where: Prisma.AuditLogWhereInput = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: 'insensitive' } },
              { entityType: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const rows = await tx.auditLog.findMany({
          where,
          ...paginate(query),
          select,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        });
        return {
          items: rows.map(view),
          total: await tx.auditLog.count({ where }),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async get(actor: Principal, id: string) {
    requireAdmin(actor);
    const row = await this.business.db.prisma.auditLog.findUnique({
      where: { id },
      select: { ...select, beforeValue: true, afterValue: true },
    });
    if (!row) throw new NotFoundException();
    const { beforeValue, afterValue, ...record } = row;
    return {
      ...view(record),
      beforeValue: beforeValue === null ? null : auditValues(beforeValue),
      afterValue: afterValue === null ? null : auditValues(afterValue),
    };
  }
}
