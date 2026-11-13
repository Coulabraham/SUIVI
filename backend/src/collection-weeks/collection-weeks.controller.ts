import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { JwtGuard, PermissionsGuard } from '../auth/permissions.js';
import { BusinessService, paginate } from '../common/business.service.js';
import { PageDto } from '../common/dto.js';
import { ApiEnvelope, WeekDto } from '../common/response.dto.js';

class CollectionWeeksQuery extends PageDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() objectiveId!: string;
}
@ApiTags('collection-weeks')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('collection-weeks')
export class CollectionWeeksController {
  constructor(private readonly business: BusinessService) {}
  @Get()
  @ApiEnvelope(WeekDto, 200, true)
  async list(@Query() query: CollectionWeeksQuery) {
    const where = { objectiveId: query.objectiveId };
    const [items, total] = await this.business.db.prisma.$transaction([
      this.business.db.prisma.collectionWeek.findMany({
        where,
        ...paginate(query),
        orderBy: { number: 'asc' },
      }),
      this.business.db.prisma.collectionWeek.count({ where }),
    ]);
    return { data: { items, total, page: query.page, pageSize: query.pageSize } };
  }
}
