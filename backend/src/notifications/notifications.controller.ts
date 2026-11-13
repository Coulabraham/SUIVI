import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { JwtGuard, PermissionsGuard } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ApiEnvelope } from '../common/response.dto.js';
import { NotificationResponseDto } from './notifications.response.js';
import {
  NotificationsQuery,
  NotificationScopeQuery,
  ReadNotificationsDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';
class UnreadDto {
  @ApiProperty() unread!: number;
}
class MarkedDto {
  @ApiProperty() updated!: number;
}
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() @ApiEnvelope(NotificationResponseDto, 200, true) async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationsQuery,
  ) {
    return { data: await this.service.list(req.user, query) };
  }
  @Get('unread-count') @ApiEnvelope(UnreadDto) async count(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationScopeQuery,
  ) {
    return { data: await this.service.count(req.user, query.departmentId) };
  }
  @Patch('read-all') @ApiEnvelope(MarkedDto) async readAll(
    @Body() _dto: ReadNotificationsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.service.read(req.user) };
  }
  @Get(':id') @ApiEnvelope(NotificationResponseDto) async get(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.service.get(req.user, id) };
  }
  @Patch(':id/read') @ApiEnvelope(NotificationResponseDto) async read(
    @Body() _dto: ReadNotificationsDto,
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.service.read(req.user, id) };
  }
}
