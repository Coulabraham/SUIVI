import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard, PermissionsGuard, Roles } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PageDto } from '../common/dto.js';
import { ApiEnvelope, ManagerDto, InitialAccessDto, UserDto } from '../common/response.dto.js';
import { ManagerCreateDto, ManagerUpdateDto, ResetPasswordDto } from './managers.dto.js';
import { ManagersService } from './managers.service.js';

@ApiTags('managers')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('managers')
export class ManagersController {
  constructor(private readonly service: ManagersService) {}
  @ApiEnvelope(ManagerDto, 200, true)
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: PageDto) {
    return { data: await this.service.list(req.user, query) };
  }
  @ApiEnvelope(ManagerDto)
  @Get(':id')
  async get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(req.user, id) };
  }
  @ApiEnvelope(InitialAccessDto, 201)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: ManagerCreateDto) {
    return { data: await this.service.create(req.user, dto, req.requestId) };
  }
  @ApiEnvelope(UserDto)
  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagerUpdateDto,
  ) {
    return { data: await this.service.update(req.user, id, dto, req.requestId) };
  }
  @ApiEnvelope(InitialAccessDto, 201)
  @Post(':id/reset-password')
  async reset(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return { data: await this.service.reset(req.user, id, dto, req.requestId) };
  }
}
