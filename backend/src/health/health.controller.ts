import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse, ServiceHealth } from '@suivi/contracts';
import { DatabaseService } from '../database/database.service.js';

class ServiceHealthDto implements ServiceHealth {
  @ApiProperty({ enum: ['SUIVI'] })
  service!: 'SUIVI';

  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ format: 'date-time' })
  checkedAt!: string;
}

class HealthResponseDto implements ApiResponse<ServiceHealth> {
  @ApiProperty({ type: ServiceHealthDto })
  data!: ServiceHealth;
}

@ApiTags('Santé')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('live')
  @ApiOkResponse({ type: HealthResponseDto, description: 'Le processus API répond.' })
  live(): ApiResponse<ServiceHealth> {
    return { data: { service: 'SUIVI', status: 'ok', checkedAt: new Date().toISOString() } };
  }

  @Get('ready')
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'La connexion PostgreSQL est disponible.',
  })
  @ApiServiceUnavailableResponse({ description: 'La base de données ne répond pas.' })
  async ready(): Promise<ApiResponse<ServiceHealth>> {
    if (!(await this.database.isReady())) throw new ServiceUnavailableException();
    return this.live();
  }
}
