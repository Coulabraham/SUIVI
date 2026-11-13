import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PageDto } from '../common/dto.js';
export class AuditQuery extends PageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Z_]+$/)
  action?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  @Matches(/^[A-Za-z]+$/)
  entityType?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional({ enum: ['SUCCESS', 'DENIED', 'FAILURE'] })
  @IsOptional()
  @IsIn(['SUCCESS', 'DENIED', 'FAILURE'])
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(Z|[+-]\d\d:\d\d)$/)
  from?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(Z|[+-]\d\d:\d\d)$/)
  to?: string;
}
