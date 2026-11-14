import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import type {
  AuthResult,
  DepartmentView,
  ManagerView,
  MemberView,
  ObjectiveView,
  PaymentView,
  ProgressView,
  UserProfile,
  WeekView,
  DashboardView,
  RegistrationStatus,
} from '@suivi/contracts';

export class UserDto implements UserProfile {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() login!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ['SUPER_ADMIN', 'MANAGER'] }) role!: UserProfile['role'];
  @ApiProperty({ type: String, nullable: true }) departmentId!: string | null;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: UserProfile['status'];
}
export class AuthResultDto implements AuthResult {
  @ApiProperty({ description: 'JWT court ; conserver en mémoire uniquement.' })
  accessToken!: string;
  @ApiProperty({ type: UserDto }) user!: UserDto;
}
export class RegistrationStatusDto implements RegistrationStatus {
  @ApiProperty() registrationOpen!: boolean;
}
export class PasswordChangedDto {
  @ApiProperty() changed!: boolean;
}
export class SessionRevokedDto {
  @ApiProperty() revoked!: boolean;
}
class ErrorDetailDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
}
class ErrorDto {
  @ApiProperty({ type: ErrorDetailDto }) error!: ErrorDetailDto;
}
export class ManagerDto extends UserDto implements ManagerView {
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) departmentName!: string | null;
}
export class InitialAccessDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({
    description: 'Secret aléatoire affiché une seule fois ; jamais conservé en clair.',
  })
  initialPassword!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
class DepartmentManagerDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}
export class DepartmentDto implements DepartmentView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: DepartmentView['status'];
  @ApiProperty() version!: number;
  @ApiProperty({ type: DepartmentManagerDto, nullable: true })
  manager!: DepartmentManagerDto | null;
}
export class MemberDto implements MemberView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() memberNumber!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: String, nullable: true }) contact!: string | null;
  @ApiProperty({ type: String, nullable: true }) neighborhood!: string | null;
  @ApiProperty({ format: 'uuid' }) departmentId!: string;
  @ApiProperty() departmentName!: string;
  @ApiProperty({ format: 'date-time' }) registeredAt!: string;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: MemberView['status'];
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, description: 'Entier décimal FCFA calculé à partir du ledger.' })
  totalAmount!: string;
}
export class PaymentDto implements PaymentView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) memberId!: string;
  @ApiProperty() memberLabel!: string;
  @ApiProperty({ format: 'uuid' }) departmentId!: string;
  @ApiProperty() departmentName!: string;
  @ApiProperty() collectedBy!: string;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty({ type: String }) originalAmount!: string;
  @ApiProperty() method!: string;
  @ApiProperty({ type: String, nullable: true }) reference!: string | null;
  @ApiProperty({ format: 'date-time' }) collectedAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ format: 'uuid' }) collectionWeekId!: string;
  @ApiProperty({ format: 'uuid' }) objectiveId!: string;
  @ApiProperty({ enum: ['VALIDATED', 'CANCELLED'] }) status!: PaymentView['status'];
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) idempotencyKey!: string;
}
class RevisionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CORRECTION', 'CANCELLATION'] }) kind!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String }) previousAmount!: string;
  @ApiProperty({ type: String }) newAmount!: string;
  @ApiProperty() previousMethod!: string;
  @ApiProperty() newMethod!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class PaymentDetailsDto extends PaymentDto {
  @ApiProperty({ type: [RevisionDto] }) revisions!: RevisionDto[];
}
export class WeekDto implements WeekView {
  @ApiProperty() id!: string;
  @ApiProperty() number!: number;
  @ApiProperty({ format: 'date-time' }) startsOn!: string;
  @ApiProperty({ format: 'date-time' }) endsOn!: string;
  @ApiProperty({ type: String, nullable: true }) collectionOn!: string | null;
  @ApiProperty({ enum: ['OPEN', 'CLOSED'] }) status!: WeekView['status'];
}
export class ObjectiveDto implements ObjectiveView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String }) targetAmount!: string;
  @ApiProperty({ format: 'date-time' }) startsOn!: string;
  @ApiProperty({ format: 'date-time' }) endsOn!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: ['PLANNED', 'ACTIVE', 'SUSPENDED', 'CLOSED'] })
  status!: ObjectiveView['status'];
  @ApiProperty() version!: number;
  @ApiProperty({ type: [WeekDto] }) weeks!: WeekDto[];
}
export class ProgressDto implements ProgressView {
  @ApiProperty({ type: String }) targetAmount!: string;
  @ApiProperty({ type: String }) totalAmount!: string;
  @ApiProperty({ type: String }) remainingAmount!: string;
  @ApiProperty({ type: String }) exceededAmount!: string;
  @ApiProperty({
    type: String,
    description: 'Pourcentage décimal tronqué à deux décimales, dépassement conservé.',
  })
  percentage!: string;
}
class CountsDto {
  @ApiProperty() departments!: number;
  @ApiProperty() managers!: number;
  @ApiProperty() activeMembers!: number;
  @ApiProperty() archivedMembers!: number;
}
class ContributionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String }) totalAmount!: string;
}
export class DashboardDto implements DashboardView {
  @ApiProperty({ type: CountsDto }) counts!: CountsDto;
  @ApiProperty({ type: ObjectiveDto, nullable: true }) objective!: ObjectiveDto | null;
  @ApiProperty({ type: ProgressDto, nullable: true }) progress!: ProgressDto | null;
  @ApiProperty({ type: String }) departmentTotal!: string;
  @ApiProperty({ type: String }) weekTotal!: string;
  @ApiProperty({ type: [ContributionDto] }) departments!: ContributionDto[];
  @ApiProperty({ type: [ContributionDto] }) members!: ContributionDto[];
  @ApiProperty({ type: [PaymentDto] }) recentPayments!: PaymentDto[];
}
export function ApiEnvelope(model: Type<unknown>, status = 200, page = false) {
  const schema = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model, ErrorDto),
    ...[400, 401, 403, 404, 409, 429, 503].map((errorStatus) =>
      ApiResponse({ status: errorStatus, schema: { $ref: getSchemaPath(ErrorDto) } }),
    ),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data: page
            ? {
                type: 'object',
                required: ['items', 'total', 'page', 'pageSize'],
                properties: {
                  items: { type: 'array', items: schema },
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                },
              }
            : schema,
        },
      },
    }),
  );
}
