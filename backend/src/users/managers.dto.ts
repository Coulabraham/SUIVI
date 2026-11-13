import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Length, Max, Min, Matches } from 'class-validator';
import { trim, OptionalField } from '../common/dto.js';

export class ManagerFieldsDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) login!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) firstName!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) lastName!: string;
  @ApiProperty({ required: false })
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(0, 32)
  phone?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() departmentId!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) @IsIn(['ACTIVE', 'INACTIVE']) status!:
    'ACTIVE' | 'INACTIVE';
}
export class ManagerCreateDto extends ManagerFieldsDto {
  @ApiProperty({
    minimum: 1,
    maximum: 168,
    description: 'Validité du mot de passe initial, choisie explicitement par administrateur.',
  })
  @IsInt()
  @Min(1)
  @Max(168)
  initialValidityHours!: number;
}
export class ManagerUpdateDto extends PartialType(ManagerFieldsDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 1000) @Matches(/\S/) reason!: string;
}
export class ResetPasswordDto {
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(168) initialValidityHours!: number;
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 1000) @Matches(/\S/) reason!: string;
}
