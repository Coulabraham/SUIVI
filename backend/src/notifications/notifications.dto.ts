import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PageDto } from '../common/dto.js';

export class NotificationsQuery extends PageDto {
  @ApiPropertyOptional({ enum: ['ALL', 'UNREAD', 'READ'], default: 'ALL' })
  @IsIn(['ALL', 'UNREAD', 'READ'])
  readState: 'ALL' | 'UNREAD' | 'READ' = 'ALL';
  @ApiPropertyOptional({ enum: ['INFORMATION', 'WARNING', 'ERROR', 'SECURITY'] })
  @IsOptional()
  @IsIn(['INFORMATION', 'WARNING', 'ERROR', 'SECURITY'])
  type?: 'INFORMATION' | 'WARNING' | 'ERROR' | 'SECURITY';
}
export class NotificationScopeQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
}
export class ReadNotificationsDto {
  @ApiProperty({ enum: [true] }) @Equals(true) read!: true;
}
