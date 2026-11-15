import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/auth.types.js';
import {
  BusinessService,
  checkVersion,
  paginate,
  requireAdmin,
  type Transaction,
} from '../common/business.service.js';
import type { PageDto, ReasonDto } from '../common/dto.js';
import type { MemberCreateDto, MemberUpdateDto, MemberTransferDto } from './members.dto.js';

@Injectable()
export class MembersService {
  constructor(private readonly business: BusinessService) {}
  async list(actor: Principal, query: PageDto) {
    const departmentId = this.business.scope(actor, query.departmentId);
    const terms = query.q?.split(/\s+/) ?? [];
    const nameSearch: Prisma.MemberWhereInput[] = terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ],
    }));
    const where: Prisma.MemberWhereInput = {
      ...(departmentId ? { departmentId } : {}),
      ...(query.q
        ? {
            OR: [
              ...['firstName', 'lastName', 'memberNumber', 'contact'].map((field) => ({
                [field]: { contains: query.q, mode: 'insensitive' },
              })),
              ...(terms.length > 1 ? [{ AND: nameSearch }] : []),
            ],
          }
        : {}),
    };
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const rows = await tx.member.findMany({
          where,
          ...paginate(query),
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
          include: { department: { select: { name: true } } },
        });
        const total = await tx.member.count({ where });
        const totals = rows.length
          ? await tx.$queryRaw<{ member_id: string; total: string }[]>(
              Prisma.sql`SELECT member_id,sum(effective_amount)::text AS total FROM payment_balances WHERE status='VALIDATED' AND member_id IN (${Prisma.join(rows.map((row) => row.id))}) ${departmentId ? Prisma.sql`AND department_id=${departmentId}::uuid` : Prisma.empty} GROUP BY member_id`,
            )
          : [];
        const amounts = new Map(totals.map((row) => [row.member_id, row.total]));
        return {
          items: rows.map(({ department, ...row }) => ({
            ...row,
            departmentName: department.name,
            totalAmount: amounts.get(row.id) ?? '0',
          })),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async get(actor: Principal, id: string) {
    return this.business.db.prisma.$transaction((tx) => this.view(tx, actor, id), {
      isolationLevel: 'RepeatableRead',
    });
  }
  private async view(tx: Transaction, actor: Principal, id: string) {
    const departmentId = this.business.scope(actor);
    const row = await tx.member.findFirst({
      where: { id, ...(departmentId ? { departmentId } : {}) },
      include: { department: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException();
    const totals = await tx.$queryRaw<{ total: string }[]>(
      Prisma.sql`SELECT coalesce(sum(effective_amount),0)::text AS total FROM payment_balances WHERE status='VALIDATED' AND member_id=${id}::uuid ${departmentId ? Prisma.sql`AND department_id=${departmentId}::uuid` : Prisma.empty}`,
    );
    const { department, ...member } = row;
    return { ...member, departmentName: department.name, totalAmount: totals[0]?.total ?? '0' };
  }
  async create(actor: Principal, dto: MemberCreateDto, requestId: string) {
    this.business.scope(actor, dto.departmentId);
    return this.business.transaction(actor, async (tx) => {
      await this.business.activeDepartment(tx, dto.departmentId);
      const row = await tx.member.create({ data: dto });
      await tx.memberDepartmentPeriod.create({
        data: {
          memberId: row.id,
          departmentId: row.departmentId,
          startsAt: row.registeredAt,
          createdById: actor.id,
        },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'MEMBER_CREATED',
        'Member',
        row.id,
        row.departmentId,
        undefined,
        row,
      );
      return this.view(tx, actor, row.id);
    });
  }
  async update(actor: Principal, id: string, dto: MemberUpdateDto, requestId: string) {
    const departmentId = this.business.scope(actor);
    return this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM members WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.member.findFirst({
        where: { id, ...(departmentId ? { departmentId } : {}) },
      });
      if (!before) throw new NotFoundException();
      await this.business.activeDepartment(tx, before.departmentId);
      const { version, ...data } = dto;
      checkVersion(before.version, version);
      const row = await tx.member.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'MEMBER_UPDATED',
        'Member',
        id,
        row.departmentId,
        before,
        row,
      );
      return this.view(tx, actor, row.id);
    });
  }
  async status(
    actor: Principal,
    id: string,
    status: 'ACTIVE' | 'ARCHIVED',
    dto: ReasonDto,
    requestId: string,
  ) {
    // En attente de Q07 : pas d'extension implicite des droits de réactivation.
    if (status === 'ACTIVE' && actor.role !== 'SUPER_ADMIN')
      throw new ForbiddenException({
        code: 'REACTIVATION_ADMIN_REQUIRED',
        message:
          'La réactivation par un responsable attend la validation de la règle métier. Contactez le Super Administrateur.',
      });
    const departmentId = this.business.scope(actor);
    return this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM members WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.member.findFirst({
        where: { id, ...(departmentId ? { departmentId } : {}) },
      });
      if (!before) throw new NotFoundException();
      checkVersion(before.version, dto.version);
      await this.business.activeDepartment(tx, before.departmentId);
      if (before.status === status)
        throw new ConflictException({
          code: 'STATUS_UNCHANGED',
          message: 'Le membre possède déjà ce statut.',
        });
      const row = await tx.member.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        status === 'ACTIVE' ? 'MEMBER_REACTIVATED' : 'MEMBER_ARCHIVED',
        'Member',
        id,
        row.departmentId,
        before,
        { ...row, reason: dto.reason },
      );
      return this.view(tx, actor, row.id);
    });
  }
  async transfer(actor: Principal, id: string, dto: MemberTransferDto, requestId: string) {
    requireAdmin(actor);
    return this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM members WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.member.findUnique({ where: { id } });
      if (!before) throw new NotFoundException();
      checkVersion(before.version, dto.version);
      if (dto.departmentId === before.departmentId) throw new ConflictException();
      await this.business.activeDepartment(tx, dto.departmentId);
      const at = new Date();
      await tx.memberDepartmentPeriod.updateMany({
        where: { memberId: id, endsAt: null },
        data: { endsAt: at },
      });
      const row = await tx.member.update({
        where: { id },
        data: { departmentId: dto.departmentId, version: { increment: 1 } },
      });
      await tx.memberDepartmentPeriod.create({
        data: { memberId: id, departmentId: dto.departmentId, startsAt: at, createdById: actor.id },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'MEMBER_TRANSFERRED',
        'Member',
        id,
        row.departmentId,
        before,
        { ...row, reason: dto.reason },
      );
      return this.view(tx, actor, row.id);
    });
  }
}
