import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsString, Length, Matches, Min } from 'class-validator';
import { trim, OptionalField } from '../common/dto.js';

export class ObjectiveCreateDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 160) name!: string;
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,18}$' })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  targetAmount!: string;
  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startsOn!: string;
  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn!: string;
  @ApiProperty({ example: 'Africa/Abidjan' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  timezone!: string;
  @ApiProperty({
    enum: ['SUNDAY_SATURDAY'],
    description: 'Choix explicite du calendrier à la création ; aucun défaut silencieux.',
  })
  @IsIn(['SUNDAY_SATURDAY'])
  calendar!: 'SUNDAY_SATURDAY';
  @ApiProperty({ enum: ['PLANNED', 'ACTIVE'] }) @IsIn(['PLANNED', 'ACTIVE']) status!:
    'PLANNED' | 'ACTIVE';
}
export class ObjectiveUpdateDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiPropertyOptional()
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  name?: string;
  @ApiPropertyOptional({ type: String })
  @OptionalField()
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  targetAmount?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] })
  @OptionalField()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CLOSED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 1000) reason!: string;
}
