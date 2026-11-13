import { Module } from '@nestjs/common';
import { ObjectivesController } from './objectives.controller.js';
import { ObjectivesService } from './objectives.service.js';
import { CollectionWeeksController } from '../collection-weeks/collection-weeks.controller.js';
@Module({
  controllers: [ObjectivesController, CollectionWeeksController],
  providers: [ObjectivesService],
})
export class ObjectivesModule {}
