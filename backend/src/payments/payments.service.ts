import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentView } from '@suivi/contracts';
import type { Principal } from '../auth/auth.types.js';
import {
  BusinessService,
  checkVersion,
  paginate,
  requireAdmin,
} from '../common/business.service.js';
import { calendarDate, money } from '../common/money.js';
import type { ReasonDto } from '../common/dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PaymentCreateDto, PaymentQueryDto, PaymentRevisionDto } from './payments.dto.js';

export const paymentInclude = {
  department: { select: { name: true } },
  collectedBy: { select: { firstName: true, lastName: true } },
  adjustments: { select: { deltaAmount: true } },
  revisions: { orderBy: { revisionNumber: 'desc' as const } },
} satisfies Prisma.PaymentInclude;
export type PaymentRecord = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;
export function paymentView(row: PaymentRecord): PaymentView {
  const amount =
    row.originalAmount + row.adjustments.reduce((total, entry) => total + entry.deltaAmount, 0n);
  return {
    id: row.id,
    memberId: row.memberId,
    memberLabel: row.memberLabelSnapshot,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    collectedBy: row.collectedBy.firstName + ' ' + row.collectedBy.lastName,
    amount: amount.toString(),
    originalAmount: row.originalAmount.toString(),
    method: row.revisions[0]?.newMethod ?? row.method,
    reference: row.reference,
    collectedAt: row.collectedAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    collectionWeekId: row.collectionWeekId,
    objectiveId: row.objectiveId,
    status: row.status,
    version: row.version,
    idempotencyKey: row.idempotencyKey,
  };
}

@Injectable()
export class PaymentsService {
  constructor(private readonly business: BusinessService) {}
  async list(actor: Principal, query: PaymentQueryDto) {
    const departmentId = this.business.scope(actor, query.departmentId);
    const where: Prisma.PaymentWhereInput = {
      ...(departmentId ? { departmentId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.objectiveId ? { objectiveId: query.objectiveId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { memberLabelSnapshot: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const rows = await tx.payment.findMany({
          where,
          ...paginate(query),
          orderBy: [{ collectedAt: 'desc' }, { id: 'desc' }],
          include: paymentInclude,
        });
        const total = await tx.payment.count({ where });
        return { items: rows.map(paymentView), total, page: query.page, pageSize: query.pageSize };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async get(actor: Principal, id: string) {
    const departmentId = this.business.scope(actor);
    const row = await this.business.db.prisma.payment.findFirst({
      where: { id, ...(departmentId ? { departmentId } : {}) },
      include: paymentInclude,
    });
    if (!row) throw new NotFoundException();
    return {
      ...paymentView(row),
      revisions: row.revisions.map((r) => ({
        id: r.id,
        kind: r.kind,
        reason: r.reason,
        previousAmount: r.previousAmount.toString(),
        newAmount: r.newAmount.toString(),
        previousMethod: r.previousMethod,
        newMethod: r.newMethod,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
  async create(actor: Principal, dto: PaymentCreateDto, requestId: string) {
    // Le cahier désigne les responsables comme encaisseurs ; Q13 ne leur ajoute pas implicitement un autre rôle.
    if (actor.role !== 'MANAGER' || !actor.departmentId) throw new ForbiddenException();
    const amount = money(dto.amount);
    const collectedAt = new Date(dto.collectedAt);
    if (collectedAt.getTime() > Date.now() + 60000)
      throw new BadRequestException({
        code: 'PAYMENT_IN_FUTURE',
        message: 'Un encaissement ne peut pas être daté dans le futur.',
      });
    return this.business.transaction(actor, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dto.idempotencyKey},0))`;
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: paymentInclude,
      });
      if (existing) {
        if (
          existing.departmentId !== actor.departmentId ||
          existing.collectedById !== actor.id ||
          existing.originDeviceId !== actor.deviceId ||
          existing.memberId !== dto.memberId ||
          existing.collectionWeekId !== dto.collectionWeekId ||
          existing.originalAmount !== amount ||
          existing.method !== dto.method ||
          (existing.reference ?? '') !== (dto.reference ?? '') ||
          existing.collectedAt.getTime() !== collectedAt.getTime()
        )
          throw new ConflictException({
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            message:
              'Cette clé a déjà été utilisée pour un encaissement différent. Aucun nouveau paiement n’a été créé.',
          });
        return paymentView(existing);
      }
      const departmentId = actor.departmentId!;
      await this.business.activeDepartment(tx, departmentId);
      const member = await tx.member.findFirst({
        where: { id: dto.memberId, departmentId },
        include: { periods: { where: { endsAt: null } } },
      });
      if (!member) throw new NotFoundException();
      if (member.status !== 'ACTIVE')
        throw new ConflictException({
          code: 'MEMBER_ARCHIVED',
          message: 'Réactivez le membre avant de saisir un encaissement.',
        });
      const week = await tx.collectionWeek.findUnique({
        where: { id: dto.collectionWeekId },
        include: { objective: true },
      });
      if (!week) throw new NotFoundException();
      if (week.status !== 'OPEN' || week.objective.status !== 'ACTIVE')
        throw new ConflictException({
          code: 'CAMPAIGN_NOT_OPEN',
          message: 'La campagne ou la semaine est fermée.',
        });
      const local = calendarDate(collectedAt, week.objective.timezone);
      if (
        local < week.startsOn.toISOString().slice(0, 10) ||
        local > week.endsOn.toISOString().slice(0, 10)
      )
        throw new BadRequestException({
          code: 'PAYMENT_WEEK_MISMATCH',
          message: 'La date doit appartenir à la semaine de collecte sélectionnée.',
        });
      if (
        calendarDate(new Date(), week.objective.timezone) >
        week.objective.endsOn.toISOString().slice(0, 10)
      )
        throw new ConflictException({
          code: 'LATE_PAYMENT_REQUIRES_REVIEW',
          message:
            'La date de fin de campagne est dépassée. Le traitement des encaissements tardifs nécessite une décision administrative.',
        });
      const period = member.periods[0];
      if (!period || collectedAt < period.startsAt)
        throw new ConflictException({
          code: 'AFFILIATION_DATE_CONFLICT',
          message: 'La date précède l’affectation actuelle du membre.',
        });
      const row = await tx.payment.create({
        data: {
          memberId: member.id,
          departmentId,
          affiliationId: period.id,
          collectedById: actor.id,
          objectiveId: week.objectiveId,
          collectionWeekId: week.id,
          originalAmount: amount,
          method: dto.method,
          reference: dto.reference || null,
          collectedAt,
          idempotencyKey: dto.idempotencyKey,
          originDeviceId: actor.deviceId,
          memberLabelSnapshot: member.firstName + ' ' + member.lastName,
        },
        include: paymentInclude,
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        'PAYMENT_CREATED',
        'Payment',
        row.id,
        departmentId,
        undefined,
        paymentView(row),
      );
      return paymentView(row);
    });
  }
  async revise(
    actor: Principal,
    id: string,
    dto: PaymentRevisionDto | ReasonDto,
    kind: 'CORRECTION' | 'CANCELLATION',
    requestId: string,
  ) {
    requireAdmin(actor);
    return this.business.transaction(actor, async (tx) => {
      // Le rôle applicatif n'a volontairement aucun droit UPDATE sur payments.
      // Le trigger SECURITY DEFINER verrouille ensuite la ligne et revérifie la version.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},1))`;
      const before = await tx.payment.findUnique({ where: { id }, include: paymentInclude });
      if (!before) throw new NotFoundException();
      checkVersion(before.version, dto.version);
      if (before.status !== 'VALIDATED')
        throw new ConflictException({
          code: 'PAYMENT_CANCELLED',
          message: 'Ce paiement est déjà annulé.',
        });
      const view = paymentView(before);
      const amount =
        kind === 'CANCELLATION'
          ? 0n
          : 'amount' in dto && dto.amount !== undefined
            ? money(dto.amount)
            : BigInt(view.amount);
      const method = 'method' in dto && dto.method !== undefined ? dto.method : view.method;
      if (kind === 'CORRECTION' && amount === BigInt(view.amount) && method === view.method)
        throw new BadRequestException({
          code: 'CORRECTION_UNCHANGED',
          message: 'Indiquez un montant ou un mode différent.',
        });
      const revision = await tx.paymentRevision.create({
        data: {
          paymentId: id,
          revisionNumber: before.version,
          actorId: actor.id,
          deviceId: actor.deviceId,
          reason: dto.reason,
          kind,
          previousAmount: BigInt(view.amount),
          newAmount: amount,
          previousMethod: view.method,
          newMethod: method,
          beforeValue: { amount: view.amount, method: view.method },
          afterValue: { amount: amount.toString(), method },
        },
      });
      await this.business.audit(
        tx,
        actor,
        requestId,
        kind === 'CANCELLATION' ? 'PAYMENT_CANCELLED' : 'PAYMENT_CORRECTED',
        'PaymentRevision',
        revision.id,
        before.departmentId,
        { amount: view.amount, method: view.method },
        { amount: amount.toString(), method, reason: dto.reason },
      );
      return paymentView(
        await tx.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude }),
      );
    });
  }
}
