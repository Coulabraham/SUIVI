import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Min } from 'class-validator';
import { trim, OptionalField } from '../common/dto.js';

export class DepartmentCreateDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiProperty({ required: false })
  @OptionalField()
  @Transform(trim)
  @IsString()
  @Length(0, 2000)
  description?: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) @IsIn(['ACTIVE', 'INACTIVE']) status!:
    'ACTIVE' | 'INACTIVE';
}
export class DepartmentUpdateDto extends PartialType(DepartmentCreateDto, {
  skipNullProperties: false,
}) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
