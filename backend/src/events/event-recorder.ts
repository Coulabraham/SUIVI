import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationPublisher } from './notification-publisher.js';
import { auditValues } from './sanitize.js';

@Injectable()
export class EventRecorder {
  constructor(private readonly notifications: NotificationPublisher) {}
  async record(tx: Prisma.TransactionClient, data: Prisma.AuditLogUncheckedCreateInput) {
    const event = await tx.auditLog.create({
      data: {
        ...data,
        ...(data.beforeValue == null ? {} : { beforeValue: auditValues(data.beforeValue) }),
        ...(data.afterValue == null ? {} : { afterValue: auditValues(data.afterValue) }),
      },
    });
    await this.notifications.publish(tx, event);
    return event;
  }
}
