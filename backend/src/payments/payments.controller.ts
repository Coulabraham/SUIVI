import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard, PermissionsGuard, Roles } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ReasonDto } from '../common/dto.js';
import { ApiEnvelope, PaymentDto, PaymentDetailsDto } from '../common/response.dto.js';
import { PaymentCreateDto, PaymentQueryDto, PaymentRevisionDto } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @ApiEnvelope(PaymentDto, 200, true)
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: PaymentQueryDto) {
    return { data: await this.service.list(req.user, query) };
  }
  @ApiEnvelope(PaymentDetailsDto)
  @Get(':id')
  async get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.get(req.user, id) };
  }
  @ApiEnvelope(PaymentDto, 201)
  @Post()
  @Roles('MANAGER')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: PaymentCreateDto) {
    return { data: await this.service.create(req.user, dto, req.requestId) };
  }
  @ApiEnvelope(PaymentDto, 201)
  @Post(':id/revisions')
  @Roles('SUPER_ADMIN')
  async revise(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentRevisionDto,
  ) {
    return { data: await this.service.revise(req.user, id, dto, 'CORRECTION', req.requestId) };
  }
  @ApiEnvelope(PaymentDto, 201)
  @Post(':id/cancellations')
  @Roles('SUPER_ADMIN')
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return { data: await this.service.revise(req.user, id, dto, 'CANCELLATION', req.requestId) };
  }
}
