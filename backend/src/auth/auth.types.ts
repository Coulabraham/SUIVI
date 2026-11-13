import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';

export interface Principal {
  id: string;
  role: UserRole;
  departmentId: string | null;
  sessionId: string;
  deviceId: string;
  credentialVersion: number;
  authzVersion: number;
  mustChangePassword: boolean;
}
export interface AuthenticatedRequest extends Request {
  user: Principal;
  requestId: string;
}
