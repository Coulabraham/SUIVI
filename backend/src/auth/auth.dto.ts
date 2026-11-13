import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty() @IsString() @Length(1, 100) login!: string;
  @ApiProperty() @IsString() @Length(1, 256) password!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() deviceId!: string;
  @ApiProperty() @IsString() @Length(1, 120) deviceLabel!: string;
}
export class ChangePasswordDto {
  @ApiProperty() @IsString() @Length(1, 256) currentPassword!: string;
  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @Length(12, 256)
  @Matches(/\S/)
  newPassword!: string;
}
