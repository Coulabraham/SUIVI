import { Module } from '@nestjs/common';
import { EventRecorder } from './event-recorder.js';
import { NotificationPublisher } from './notification-publisher.js';

@Module({
  providers: [EventRecorder, NotificationPublisher],
  exports: [EventRecorder, NotificationPublisher],
})
export class EventsModule {}
