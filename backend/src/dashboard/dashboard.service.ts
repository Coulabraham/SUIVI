import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/auth.types.js';
import { BusinessService } from '../common/business.service.js';
import { calendarDate, financialProgress } from '../common/money.js';
import { paymentInclude, paymentView } from '../payments/payments.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly business: BusinessService) {}
  async get(actor: Principal, requestedObjectiveId?: string) {
    const departmentId = this.business.scope(actor);
    return this.business.db.prisma.$transaction(
      async (tx) => {
        const objective = requestedObjectiveId
          ? await tx.objective.findUnique({
              where: { id: requestedObjectiveId },
              include: { weeks: { orderBy: { number: 'asc' } } },
            })
          : await tx.objective.findFirst({
              where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
              orderBy: { createdAt: 'desc' },
              include: { weeks: { orderBy: { number: 'asc' } } },
            });
        if (requestedObjectiveId && !objective) throw new NotFoundException();
        const counts = {
          departments: await tx.department.count({
            where: { ...(departmentId ? { id: departmentId } : {}) },
          }),
          managers: await tx.user.count({
            where: { role: 'MANAGER', status: 'ACTIVE', ...(departmentId ? { departmentId } : {}) },
          }),
          activeMembers: await tx.member.count({
            where: { status: 'ACTIVE', ...(departmentId ? { departmentId } : {}) },
          }),
          archivedMembers: await tx.member.count({
            where: { status: 'ARCHIVED', ...(departmentId ? { departmentId } : {}) },
          }),
        };
        if (!objective)
          return {
            counts,
            objective: null,
            progress: null,
            departmentTotal: '0',
            weekTotal: '0',
            departments: [],
            members: [],
            recentPayments: [],
          };
        const objectiveId = objective.id;
        const total = await tx.$queryRaw<
          { total: string }[]
        >`SELECT coalesce(sum(effective_amount),0)::text AS total FROM payment_balances WHERE objective_id=${objectiveId}::uuid AND status='VALIDATED'`;
        const local = calendarDate(new Date(), objective.timezone);
        const week = objective.weeks.find(
          (week) =>
            week.startsOn.toISOString().slice(0, 10) <= local &&
            week.endsOn.toISOString().slice(0, 10) >= local,
        );
        const deptFilter = departmentId
          ? Prisma.sql`AND b.department_id=${departmentId}::uuid`
          : Prisma.empty;
        const departments = await tx.$queryRaw<{ id: string; name: string; totalAmount: string }[]>(
          Prisma.sql`SELECT d.id,d.name,coalesce(sum(b.effective_amount),0)::text AS "totalAmount" FROM departments d LEFT JOIN payment_balances b ON b.department_id=d.id AND b.objective_id=${objectiveId}::uuid AND b.status='VALIDATED' ${departmentId ? Prisma.sql`WHERE d.id=${departmentId}::uuid` : Prisma.empty} GROUP BY d.id,d.name ORDER BY d.name`,
        );
        const memberRows = await tx.$queryRaw<{ id: string; name: string; totalAmount: string }[]>(
          Prisma.sql`SELECT b.member_id AS id,max(p.member_label_snapshot) AS name,sum(b.effective_amount)::text AS "totalAmount" FROM payment_balances b JOIN payments p ON p.id=b.id WHERE b.objective_id=${objectiveId}::uuid AND b.status='VALIDATED' ${deptFilter} GROUP BY b.member_id ORDER BY sum(b.effective_amount) DESC,b.member_id LIMIT 10`,
        );
        const weekTotal = week
          ? await tx.$queryRaw<{ total: string }[]>(
              Prisma.sql`SELECT coalesce(sum(b.effective_amount),0)::text AS total FROM payment_balances b WHERE b.objective_id=${objectiveId}::uuid AND b.collection_week_id=${week.id}::uuid AND b.status='VALIDATED' ${deptFilter}`,
            )
          : [];
        const recent = await tx.payment.findMany({
          where: { objectiveId, ...(departmentId ? { departmentId } : {}) },
          take: 8,
          orderBy: [{ collectedAt: 'desc' }, { id: 'desc' }],
          include: paymentInclude,
        });
        return {
          counts,
          objective,
          progress: financialProgress(objective.targetAmount, BigInt(total[0]?.total ?? '0')),
          departmentTotal: departments
            .reduce((sum, row) => sum + BigInt(row.totalAmount), 0n)
            .toString(),
          weekTotal: weekTotal[0]?.total ?? '0',
          departments,
          members: memberRows,
          recentPayments: recent.map(paymentView),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
}
