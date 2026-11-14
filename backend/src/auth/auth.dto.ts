import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { AuthPortal, LoginInput, RegisterAdminInput } from '@suivi/contracts';

class BotProtectedDto {
  @ApiPropertyOptional({ description: 'Champ piège : doit être absent ou vide.', maxLength: 0 })
  @ValidateIf((value: BotProtectedDto) => value.website !== undefined)
  @IsString()
  @MaxLength(0, { message: 'Le formulaire n’est pas valide.' })
  website?: string;
}
export class LoginDto extends BotProtectedDto implements LoginInput {
  @ApiProperty() @IsString() @Length(1, 100) login!: string;
  @ApiProperty() @IsString() @Length(1, 256) password!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() deviceId!: string;
  @ApiProperty() @IsString() @Length(1, 120) deviceLabel!: string;
  @ApiPropertyOptional({ enum: ['SUPER_ADMIN', 'MANAGER'] })
  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'MANAGER'])
  portal?: AuthPortal;
}
export class RegisterAdminDto extends BotProtectedDto implements RegisterAdminInput {
  @ApiProperty({ format: 'email', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(100)
  email!: string;
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/\S/) firstName!: string;
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/\S/) lastName!: string;
  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @Length(12, 256)
  @Matches(/\S/)
  password!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() deviceId!: string;
  @ApiProperty() @IsString() @Length(1, 120) deviceLabel!: string;
}
export class ChangePasswordDto extends BotProtectedDto {
  @ApiProperty() @IsString() @Length(1, 256) currentPassword!: string;
  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @Length(12, 256)
  @Matches(/\S/)
  newPassword!: string;
}
