import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, IsUUID, Length, Min } from 'class-validator';
import { ReasonDto, trim, OptionalField } from '../common/dto.js';

export class MemberFieldsDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) firstName!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) lastName!: string;
  @ApiProperty({ required: false })
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(0, 64)
  contact?: string;
  @ApiProperty({ required: false })
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(0, 150)
  neighborhood?: string;
}
export class MemberCreateDto extends MemberFieldsDto {
  @ApiProperty({ description: 'Numéro unique saisi explicitement ; format métier non imposé.' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  memberNumber!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() departmentId!: string;
}
export class MemberUpdateDto extends PartialType(MemberFieldsDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class MemberTransferDto extends ReasonDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() departmentId!: string;
}
