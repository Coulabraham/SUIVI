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
import { PageDto, ReasonDto } from '../common/dto.js';
import { ApiEnvelope, MemberDto } from '../common/response.dto.js';
import { MemberCreateDto, MemberUpdateDto, MemberTransferDto } from './members.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly service: MembersService) {}
  @ApiEnvelope(MemberDto, 200, true)
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: PageDto) {
    return { data: await this.service.list(req.user, query) };
  }
  @ApiEnvelope(MemberDto)
  @Get(':id')
  async get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(req.user, id) };
  }
  @ApiEnvelope(MemberDto, 201)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: MemberCreateDto) {
    return { data: await this.service.create(req.user, dto, req.requestId) };
  }
  @ApiEnvelope(MemberDto)
  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberUpdateDto,
  ) {
    return { data: await this.service.update(req.user, id, dto, req.requestId) };
  }
  @ApiEnvelope(MemberDto)
  @Patch(':id/archive')
  async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return { data: await this.service.status(req.user, id, 'ARCHIVED', dto, req.requestId) };
  }
  @ApiEnvelope(MemberDto)
  @Patch(':id/reactivate')
  async reactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return { data: await this.service.status(req.user, id, 'ACTIVE', dto, req.requestId) };
  }
  @ApiEnvelope(MemberDto, 201)
  @Post(':id/transfer')
  @Roles('SUPER_ADMIN')
  async transfer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberTransferDto,
  ) {
    return { data: await this.service.transfer(req.user, id, dto, req.requestId) };
  }
}
