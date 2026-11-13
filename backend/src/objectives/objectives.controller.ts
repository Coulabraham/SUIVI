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
import { ApiEnvelope, ObjectiveDto, ProgressDto } from '../common/response.dto.js';
import { ObjectiveCreateDto, ObjectiveUpdateDto } from './objectives.dto.js';
import { ObjectivesService } from './objectives.service.js';

@ApiTags('objectives')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('objectives')
export class ObjectivesController {
  constructor(private readonly service: ObjectivesService) {}
  @ApiEnvelope(ObjectiveDto, 200, true)
  @Get()
  async list(@Query() query: PageDto) {
    return { data: await this.service.list(query) };
  }
  @ApiEnvelope(ObjectiveDto)
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(id) };
  }
  @ApiEnvelope(ProgressDto)
  @Get(':id/progress')
  async progress(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.progress(id) };
  }
  @ApiEnvelope(ObjectiveDto, 201)
  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: ObjectiveCreateDto) {
    return { data: await this.service.create(req.user, dto, req.requestId) };
  }
  @ApiEnvelope(ObjectiveDto)
  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ObjectiveUpdateDto,
  ) {
    return { data: await this.service.update(req.user, id, dto, req.requestId) };
  }
}
