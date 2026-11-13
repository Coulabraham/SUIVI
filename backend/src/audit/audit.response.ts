import { ApiProperty } from '@nestjs/swagger';
import type { AuditDetails, AuditView, JsonValue } from '@suivi/contracts';
export class AuditResponseDto implements AuditView {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) actorId!: string | null;
  @ApiProperty({ type: String, nullable: true }) actorName!: string | null;
  @ApiProperty({ enum: ['SUPER_ADMIN', 'MANAGER'], nullable: true })
  actorRole!: AuditView['actorRole'];
  @ApiProperty({ type: String, nullable: true }) departmentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) departmentName!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty({ type: String, nullable: true }) entityId!: string | null;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: ['SUCCESS', 'DENIED', 'FAILURE'] }) outcome!: AuditView['outcome'];
  @ApiProperty({ type: String, nullable: true }) deviceId!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceLabel!: string | null;
  @ApiProperty() requestId!: string;
}
export class AuditDetailsDto extends AuditResponseDto implements AuditDetails {
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  beforeValue!: JsonValue;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  afterValue!: JsonValue;
}
