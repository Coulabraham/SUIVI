/** Transport HTTP uniquement : aucun modèle Prisma et aucun secret. */
export interface ApiResponse<T> {
  data: T;
}

export interface ServiceHealth {
  service: 'SUIVI';
  status: 'ok';
  checkedAt: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface UserProfile {
  id: string;
  login: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  departmentId: string | null;
  mustChangePassword: boolean;
  version: number;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface AuthResult {
  accessToken: string;
  user: UserProfile;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DepartmentView {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  manager: { id: string; firstName: string; lastName: string } | null;
}
export interface ManagerView extends UserProfile {
  phone: string | null;
  departmentName: string | null;
}
export interface MemberView {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  contact: string | null;
  neighborhood: string | null;
  departmentId: string;
  departmentName: string;
  registeredAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  totalAmount: string;
}
export interface PaymentView {
  id: string;
  memberId: string;
  memberLabel: string;
  departmentId: string;
  departmentName: string;
  collectedBy: string;
  amount: string;
  originalAmount: string;
  method: string;
  reference: string | null;
  collectedAt: string;
  receivedAt: string;
  collectionWeekId: string;
  objectiveId: string;
  status: 'VALIDATED' | 'CANCELLED';
  version: number;
  idempotencyKey: string;
}
export interface WeekView {
  id: string;
  number: number;
  startsOn: string;
  endsOn: string;
  collectionOn: string | null;
  status: 'OPEN' | 'CLOSED';
}
export interface ObjectiveView {
  id: string;
  name: string;
  targetAmount: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  status: 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  version: number;
  weeks: WeekView[];
}
export interface ProgressView {
  targetAmount: string;
  totalAmount: string;
  remainingAmount: string;
  exceededAmount: string;
  percentage: string;
}
export interface DashboardView {
  counts: { departments: number; managers: number; activeMembers: number; archivedMembers: number };
  objective: ObjectiveView | null;
  progress: ProgressView | null;
  departmentTotal: string;
  weekTotal: string;
  departments: { id: string; name: string; totalAmount: string }[];
  members: { id: string; name: string; totalAmount: string }[];
  recentPayments: PaymentView[];
}

export type NotificationKind = 'INFORMATION' | 'WARNING' | 'ERROR' | 'SECURITY';
export interface NotificationView {
  id: string;
  departmentId: string | null;
  type: NotificationKind;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}
export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';
export interface AuditView {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: 'SUPER_ADMIN' | 'MANAGER' | null;
  departmentId: string | null;
  departmentName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  outcome: AuditOutcome;
  deviceId: string | null;
  deviceLabel: string | null;
  requestId: string;
}
export type JsonValue =
  null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
export interface AuditDetails extends AuditView {
  beforeValue: JsonValue;
  afterValue: JsonValue;
}
export const auditActionLabels: Record<string, string> = {
  ADMIN_BOOTSTRAPPED: 'Premier administrateur créé',
  LOGIN_SUCCEEDED: 'Connexion réussie',
  LOGIN_FAILED: 'Connexion refusée',
  UNUSUAL_LOGIN: 'Connexion depuis un nouvel appareil',
  PASSWORD_CHANGED: 'Mot de passe modifié',
  REFRESH_REUSE_DETECTED: 'Réutilisation d’un jeton détectée',
  SESSION_REVOKED: 'Session révoquée',
  ACCESS_RESET: 'Accès réinitialisés',
  DEPARTMENT_CREATED: 'Département créé',
  DEPARTMENT_UPDATED: 'Département modifié',
  MANAGER_CREATED: 'Responsable créé',
  MANAGER_UPDATED: 'Responsable modifié',
  MEMBER_CREATED: 'Membre ajouté',
  MEMBER_UPDATED: 'Membre modifié',
  MEMBER_ARCHIVED: 'Membre archivé',
  MEMBER_REACTIVATED: 'Membre réactivé',
  MEMBER_TRANSFERRED: 'Membre transféré',
  PAYMENT_CREATED: 'Encaissement enregistré',
  PAYMENT_CORRECTED: 'Encaissement corrigé',
  PAYMENT_CANCELLED: 'Encaissement annulé',
  OBJECTIVE_CREATED: 'Campagne créée',
  OBJECTIVE_UPDATED: 'Campagne modifiée',
  SYNC_FAILED: 'Échec de synchronisation',
  DEMO_SEEDED: 'Démonstration initialisée',
};
