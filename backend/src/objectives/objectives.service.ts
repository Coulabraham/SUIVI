import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Principal } from '../auth/auth.types.js';
import {
  BusinessService,
  checkVersion,
  requireAdmin,
  paginate,
} from '../common/business.service.js';
import { money, financialProgress } from '../common/money.js';
import type { PageDto } from '../common/dto.js';
import { sundayCalendar } from '../collection-weeks/calendar.js';
import type { ObjectiveCreateDto, ObjectiveUpdateDto } from './objectives.dto.js';

@Injectable()
export class ObjectivesService {
  constructor(private readonly business: BusinessService) {}
  async list(query: PageDto) {
    const where = query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {};
    const [items, total] = await this.business.db.prisma.$transaction([
      this.business.db.prisma.objective.findMany({
        where,
        ...paginate(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { weeks: { orderBy: { number: 'asc' } } },
      }),
      this.business.db.prisma.objective.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
  async get(id: string) {
    const row = await this.business.db.prisma.objective.findUnique({
      where: { id },
      include: { weeks: { orderBy: { number: 'asc' } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async progress(id: string) {
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const row = await tx.objective.findUnique({ where: { id } });
        if (!row) throw new NotFoundException();
        const values = await tx.$queryRaw<
          { total: string }[]
        >`SELECT coalesce(sum(effective_amount),0)::text AS total FROM payment_balances WHERE objective_id=${id}::uuid AND status='VALIDATED'`;
        return financialProgress(row.targetAmount, BigInt(values[0]?.total ?? '0'));
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async create(actor: Principal, dto: ObjectiveCreateDto, requestId: string) {
    requireAdmin(actor);
    const targetAmount = money(dto.targetAmount);
    try {
      new Intl.DateTimeFormat('fr-FR', { timeZone: dto.timezone }).format();
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TIMEZONE',
        message: 'Saisissez un fuseau IANA valide.',
      });
    }
    let weeks;
    try {
      weeks = sundayCalendar(dto.startsOn, dto.endsOn);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CAMPAIGN_DATES',
        message: 'Les dates de campagne sont invalides.',
      });
    }
    if (weeks.length > 530)
      throw new BadRequestException({
        code: 'CAMPAIGN_TOO_LONG',
        message: 'La campagne ne peut pas dépasser dix ans.',
      });
    return this.business.transaction(actor, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726384903)`;
      if (
        dto.status === 'ACTIVE' &&
        (await tx.objective.findFirst({ where: { status: { in: ['ACTIVE', 'SUSPENDED'] } } }))
      )
        throw new ConflictException({
          code: 'CURRENT_OBJECTIVE_EXISTS',
          message: 'Clôturez la campagne courante avant d’en activer une autre.',
        });
      const row = await tx.objective.create({
        data: {
          name: dto.name,
          targetAmount,
          startsOn: new Date(dto.startsOn),
          endsOn: new Date(dto.endsOn),
          timezone: dto.timezone,
          status: dto.status,
          createdById: actor.id,
        },
      });
      await tx.collectionWeek.createMany({
        data: weeks.map((week) => ({ ...week, objectiveId: row.id })),
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'OBJECTIVE_CREATED',
        'Objective',
        row.id,
        null,
        undefined,
        { ...row, calendar: dto.calendar },
      );
      return {
        ...row,
        weeks: await tx.collectionWeek.findMany({
          where: { objectiveId: row.id },
          orderBy: { number: 'asc' },
        }),
      };
    });
  }
  async update(actor: Principal, id: string, dto: ObjectiveUpdateDto, requestId: string) {
    requireAdmin(actor);
    const amount = dto.targetAmount === undefined ? undefined : money(dto.targetAmount);
    return this.business.transaction(actor, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726384903)`;
      await tx.$queryRaw`SELECT id FROM objectives WHERE id=${id}::uuid FOR UPDATE`;
      const before = await tx.objective.findUnique({ where: { id } });
      if (!before) throw new NotFoundException();
      checkVersion(before.version, dto.version);
      if (before.status === 'CLOSED')
        throw new ConflictException({
          code: 'CAMPAIGN_CLOSED',
          message: 'Une campagne clôturée conserve son historique et ne peut pas être modifiée.',
        });
      if (
        dto.status === 'ACTIVE' &&
        (await tx.objective.findFirst({
          where: { id: { not: id }, status: { in: ['ACTIVE', 'SUSPENDED'] } },
        }))
      )
        throw new ConflictException({
          code: 'CURRENT_OBJECTIVE_EXISTS',
          message: 'Clôturez la campagne courante avant d’en activer une autre.',
        });
      const row = await tx.objective.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(amount === undefined ? {} : { targetAmount: amount }),
          ...(dto.status === undefined
            ? {}
            : { status: dto.status, closedAt: dto.status === 'CLOSED' ? new Date() : null }),
          version: { increment: 1 },
        },
      });
      if (row.status === 'CLOSED')
        await tx.collectionWeek.updateMany({
          where: { objectiveId: id },
          data: { status: 'CLOSED' },
        });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'OBJECTIVE_UPDATED',
        'Objective',
        id,
        null,
        before,
        { ...row, reason: dto.reason },
      );
      return {
        ...row,
        weeks: await tx.collectionWeek.findMany({
          where: { objectiveId: id },
          orderBy: { number: 'asc' },
        }),
      };
    });
  }
}
