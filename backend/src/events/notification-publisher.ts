import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '../generated/prisma/client.js';
import { eventPolicies } from './event-policy.js';

@Injectable()
export class NotificationPublisher {
  async publish(tx: Prisma.TransactionClient, event: AuditLog) {
    const policy = eventPolicies[event.action];
    if (
      !policy ||
      (event.outcome !== 'SUCCESS' &&
        !['REFRESH_REUSE_DETECTED', 'SYNC_FAILED'].includes(event.action))
    )
      return;
    const recipients = new Map<string, string | null>();
    const admins = await tx.user.findMany({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    for (const admin of admins) recipients.set(admin.id, event.departmentId);
    const scopes = new Set<string>();
    if (event.departmentId) scopes.add(event.departmentId);
    if (
      event.action === 'MEMBER_TRANSFERRED' &&
      event.beforeValue &&
      typeof event.beforeValue === 'object' &&
      !Array.isArray(event.beforeValue)
    ) {
      const previous = event.beforeValue.departmentId;
      if (typeof previous === 'string' && /^[0-9a-f-]{36}$/i.test(previous)) scopes.add(previous);
    }
    if (scopes.size) {
      const managers = await tx.user.findMany({
        where: { role: 'MANAGER', status: 'ACTIVE', departmentId: { in: [...scopes] } },
        select: { id: true, departmentId: true },
      });
      for (const manager of managers)
        if (manager.id !== event.actorId) recipients.set(manager.id, manager.departmentId);
    }
    if (policy.personal) {
      const subject = event.entityType === 'User' ? event.entityId : event.actorId;
      if (subject && (await tx.user.findUnique({ where: { id: subject }, select: { id: true } })))
        recipients.set(subject, null);
    }
    if (!recipients.size) return;
    await tx.notification.createMany({
      data: [...recipients].map(([recipientId, departmentId]) => ({
        recipientId,
        departmentId,
        eventKey: 'audit:' + event.id,
        type: policy.type,
        title: policy.title,
        message: policy.message,
        entityType: event.entityType,
        entityId: event.entityId,
      })),
      skipDuplicates: true,
    });
  }
}
