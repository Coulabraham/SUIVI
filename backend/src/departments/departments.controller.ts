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
import { ApiEnvelope, DepartmentDto } from '../common/response.dto.js';
import { DepartmentCreateDto, DepartmentUpdateDto } from './departments.dto.js';
import { DepartmentsService } from './departments.service.js';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}
  @ApiEnvelope(DepartmentDto, 200, true)
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: PageDto) {
    return { data: await this.service.list(req.user, query) };
  }
  @ApiEnvelope(DepartmentDto)
  @Get(':id')
  async get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(req.user, id) };
  }
  @ApiEnvelope(DepartmentDto, 201)
  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: DepartmentCreateDto) {
    return { data: await this.service.create(req.user, dto, req.requestId) };
  }
  @ApiEnvelope(DepartmentDto)
  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepartmentUpdateDto,
  ) {
    return { data: await this.service.update(req.user, id, dto, req.requestId) };
  }
}
