import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, IsIn } from 'class-validator';
import { PageDto, ReasonDto, trim, OptionalField } from '../common/dto.js';

export class PaymentQueryDto extends PageDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() memberId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() objectiveId?: string;
  @ApiPropertyOptional({ enum: ['VALIDATED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['VALIDATED', 'CANCELLED'])
  status?: 'VALIDATED' | 'CANCELLED';
}
export class PaymentCreateDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() memberId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() collectionWeekId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey!: string;
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,18}$' })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amount!: string;
  @ApiProperty({ description: 'Libellé explicite ; catalogue de modes métier à confirmer.' })
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  method!: string;
  @ApiPropertyOptional()
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  reference?: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(/T.*(Z|[+-]\d\d:\d\d)$/)
  collectedAt!: string;
}
export class PaymentRevisionDto extends ReasonDto {
  @ApiPropertyOptional({ type: String })
  @OptionalField()
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amount?: string;
  @ApiPropertyOptional()
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  method?: string;
}
