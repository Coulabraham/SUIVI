import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { JwtGuard, PermissionsGuard } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { DashboardService } from './dashboard.service.js';
import { ApiEnvelope, DashboardDto } from '../common/response.dto.js';
class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() objectiveId?: string;
}
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @ApiEnvelope(DashboardDto)
  @Get()
  async get(@Req() req: AuthenticatedRequest, @Query() query: DashboardQueryDto) {
    return { data: await this.service.get(req.user, query.objectiveId) };
  }
}
