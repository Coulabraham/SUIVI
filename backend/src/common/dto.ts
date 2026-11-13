import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
  Matches,
  ValidateIf,
} from 'class-validator';

export class PageDto {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
}
export class VersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class ReasonDto extends VersionDto {
  @ApiProperty() @IsString() @Length(3, 1000) @Matches(/\S/) reason!: string;
}
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const OptionalField = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
