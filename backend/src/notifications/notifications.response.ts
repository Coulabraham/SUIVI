import { ApiProperty } from '@nestjs/swagger';
import type { NotificationView } from '@suivi/contracts';
export class NotificationResponseDto implements NotificationView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) departmentId!: string | null;
  @ApiProperty({ enum: ['INFORMATION', 'WARNING', 'ERROR', 'SECURITY'] })
  type!: NotificationView['type'];
  @ApiProperty() title!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: String, nullable: true }) entityType!: string | null;
  @ApiProperty({ type: String, nullable: true }) entityId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
}
