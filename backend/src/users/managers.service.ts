import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Principal } from '../auth/auth.types.js';
import { safeUser } from '../auth/auth.service.js';
import { hashInitialPassword } from '../common/passwords.js';
import {
  BusinessService,
  requireAdmin,
  checkVersion,
  paginate,
} from '../common/business.service.js';
import type { PageDto } from '../common/dto.js';
import type { ManagerCreateDto, ManagerUpdateDto, ResetPasswordDto } from './managers.dto.js';
const normalized = (login: string) => login.trim().normalize('NFKC').toLocaleLowerCase('en-US');

@Injectable()
export class ManagersService {
  constructor(private readonly business: BusinessService) {}
  async list(actor: Principal, query: PageDto) {
    requireAdmin(actor);
    const where = {
      role: 'MANAGER' as const,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.q
        ? {
            OR: ['firstName', 'lastName', 'loginIdentifier'].map((field) => ({
              [field]: { contains: query.q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [rows, total] = await this.business.db.prisma.$transaction([
      this.business.db.prisma.user.findMany({
        where,
        ...paginate(query),
        orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
        include: { department: true },
      }),
      this.business.db.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...safeUser(row),
        phone: row.phone,
        departmentName: row.department?.name ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(actor: Principal, id: string) {
    requireAdmin(actor);
    const row = await this.business.db.prisma.user.findFirst({
      where: { id, role: 'MANAGER' },
      include: { department: true },
    });
    if (!row) throw new NotFoundException();
    return { ...safeUser(row), phone: row.phone, departmentName: row.department?.name ?? null };
  }
  async create(actor: Principal, dto: ManagerCreateDto, requestId: string) {
    requireAdmin(actor);
    const initialPassword = randomBytes(24).toString('base64url');
    const hash = await hashInitialPassword(initialPassword);
    const expiresAt = new Date(Date.now() + dto.initialValidityHours * 3600000);
    const user = await this.business.transaction(actor, async (tx) => {
      await this.business.activeDepartment(tx, dto.departmentId);
      if (
        (await tx.user.findFirst({
          where: { role: 'MANAGER', departmentId: dto.departmentId, status: 'ACTIVE' },
        })) &&
        dto.status === 'ACTIVE'
      )
        throw new ConflictException({
          code: 'MANAGER_ALREADY_ASSIGNED',
          message: 'Désactivez le responsable actuel avant son remplacement.',
        });
      const row = await tx.user.create({
        data: {
          loginIdentifier: dto.login,
          loginNormalized: normalized(dto.login),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          departmentId: dto.departmentId,
          role: 'MANAGER',
          status: dto.status,
          passwordHash: hash,
          initialPasswordExpiresAt: expiresAt,
        },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'MANAGER_CREATED',
        'User',
        row.id,
        row.departmentId,
        undefined,
        { ...safeUser(row), phone: row.phone },
      );
      return safeUser(row);
    });
    return { user, initialPassword, expiresAt };
  }
  async update(actor: Principal, id: string, dto: ManagerUpdateDto, requestId: string) {
    requireAdmin(actor);
    return this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.user.findFirst({ where: { id, role: 'MANAGER' } });
      if (!before) throw new NotFoundException();
      if (dto.departmentId || dto.status === 'ACTIVE')
        await this.business.activeDepartment(tx, dto.departmentId ?? before.departmentId!);
      const { login, reason, version, ...fields } = dto;
      checkVersion(before.version, version);
      const row = await tx.user.update({
        where: { id },
        data: {
          ...fields,
          ...(login ? { loginIdentifier: login, loginNormalized: normalized(login) } : {}),
          authzVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'MANAGER_UPDATED',
        'User',
        id,
        row.departmentId,
        { ...safeUser(before), phone: before.phone },
        { ...safeUser(row), phone: row.phone, reason },
      );
      return safeUser(row);
    });
  }
  async reset(actor: Principal, id: string, dto: ResetPasswordDto, requestId: string) {
    requireAdmin(actor);
    const initialPassword = randomBytes(24).toString('base64url');
    const hash = await hashInitialPassword(initialPassword);
    const expiresAt = new Date(Date.now() + dto.initialValidityHours * 3600000);
    const user = await this.business.transaction(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.user.findFirst({ where: { id, role: 'MANAGER' } });
      if (!before) throw new NotFoundException();
      checkVersion(before.version, dto.version);
      const row = await tx.user.update({
        where: { id },
        data: {
          passwordHash: hash,
          mustChangePassword: true,
          initialPasswordExpiresAt: expiresAt,
          credentialVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'ACCESS_RESET',
        'User',
        id,
        row.departmentId,
        undefined,
        { reason: dto.reason, expiresAt: expiresAt.toISOString() },
      );
      return safeUser(row);
    });
    return { user, initialPassword, expiresAt };
  }
}
