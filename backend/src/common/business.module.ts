import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { BusinessService } from './business.service.js';
import { EventsModule } from '../events/events.module.js';

@Global()
@Module({
  imports: [DatabaseModule, EventsModule],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
