import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  type CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '../generated/prisma/enums.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const Roles = (...roles: UserRole[]) => SetMetadata('suivi.roles', roles);
export const AllowPasswordChange = () => SetMetadata('suivi.allowInitial', true);
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    const targets = [context.getHandler(), context.getClass()];
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>('suivi.allowInitial', targets)
    ) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Changez votre mot de passe initial pour continuer.',
      });
    }
    const roles = this.reflector.getAllAndOverride<UserRole[]>('suivi.roles', targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
