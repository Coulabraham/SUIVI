import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard, PermissionsGuard, Roles } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ApiEnvelope } from '../common/response.dto.js';
import { AuditQuery } from './audit.dto.js';
import { AuditResponseDto, AuditDetailsDto } from './audit.response.js';
import { AuditService } from './audit.service.js';
@ApiTags('audit')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() @ApiEnvelope(AuditResponseDto, 200, true) async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: AuditQuery,
  ) {
    return { data: await this.service.list(req.user, query) };
  }
  @Get(':id') @ApiEnvelope(AuditDetailsDto) async get(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.service.get(req.user, id) };
  }
}
