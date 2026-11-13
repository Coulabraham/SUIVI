import { Injectable, NotFoundException } from '@nestjs/common';
import type { Principal } from '../auth/auth.types.js';
import {
  BusinessService,
  requireAdmin,
  paginate,
  checkVersion,
} from '../common/business.service.js';
import type { PageDto } from '../common/dto.js';
import type { DepartmentCreateDto, DepartmentUpdateDto } from './departments.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly business: BusinessService) {}
  async list(actor: Principal, query: PageDto) {
    const id = this.business.scope(actor, query.departmentId);
    const where = {
      ...(id ? { id } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.business.db.prisma.$transaction([
      this.business.db.prisma.department.findMany({
        where,
        ...paginate(query),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: {
          users: {
            where: { role: 'MANAGER', status: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.business.db.prisma.department.count({ where }),
    ]);
    return {
      items: rows.map(({ users, ...row }) => ({ ...row, manager: users[0] ?? null })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(actor: Principal, id: string) {
    this.business.scope(actor, id);
    const row = await this.business.db.prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'MANAGER', status: 'ACTIVE' },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!row) throw new NotFoundException();
    const { users, ...department } = row;
    return { ...department, manager: users[0] ?? null };
  }
  async create(actor: Principal, dto: DepartmentCreateDto, requestId: string) {
    requireAdmin(actor);
    return this.business.transaction(actor, async (tx) => {
      const row = await tx.department.create({ data: dto });
      await tx.syncScope.create({ data: { key: 'DEPARTMENT:' + row.id, departmentId: row.id } });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'DEPARTMENT_CREATED',
        'Department',
        row.id,
        row.id,
        undefined,
        row,
      );
      return { ...row, manager: null };
    });
  }
  async update(actor: Principal, id: string, dto: DepartmentUpdateDto, requestId: string) {
    requireAdmin(actor);
    return this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM departments WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.department.findUnique({ where: { id } });
      if (!before) throw new NotFoundException();
      const { version, ...data } = dto;
      checkVersion(before.version, version);
      const row = await tx.department.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'DEPARTMENT_UPDATED',
        'Department',
        id,
        id,
        before,
        row,
      );
      const manager = await tx.user.findFirst({
        where: { departmentId: id, role: 'MANAGER', status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true },
      });
      return { ...row, manager };
    });
  }
}
