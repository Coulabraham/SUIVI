import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  HttpException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { transactionOptions } from '../database/transaction-options.js';
import { hashInitialPassword, verifyPasswordHash } from '../common/passwords.js';
import type { User, Session, Prisma } from '../generated/prisma/client.js';
import type { Principal } from './auth.types.js';
import type { LoginDto, ChangePasswordDto, RegisterAdminDto } from './auth.dto.js';
import { EventRecorder } from '../events/event-recorder.js';

export const safeUser = (user: User) => ({
  id: user.id,
  login: user.loginIdentifier,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  departmentId: user.departmentId,
  mustChangePassword: user.mustChangePassword,
  version: user.version,
  status: user.status,
});
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const lifetime = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  readonly jwtSecret: string;
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private readonly dummyHash = hashInitialPassword(randomBytes(32).toString('base64url'));
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly events: EventRecorder,
  ) {
    const secret = config.get<string>('AUTH_JWT_SECRET');
    if (config.get<string>('NODE_ENV') === 'production' && (!secret || secret.length < 32))
      throw new Error('AUTH_JWT_SECRET doit contenir au moins 32 caractères en production.');
    this.jwtSecret = secret ?? randomBytes(48).toString('base64url');
  }

  private checkAttempts(key: string) {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (current && current.until > now && current.count >= (key.startsWith('ip:') ? 100 : 10))
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        429,
      );
    if (this.attempts.size > 10000)
      for (const [entry, value] of this.attempts)
        if (value.until <= now) this.attempts.delete(entry);
    if (this.attempts.size > 20000) throw new HttpException('Réessayez plus tard.', 429);
    this.attempts.set(key, {
      count: (current && current.until > now ? current.count : 0) + 1,
      until: current && current.until > now ? current.until : now + 900000,
    });
  }

  async registrationStatus() {
    return {
      registrationOpen: (await this.db.prisma.user.count({ where: { role: 'SUPER_ADMIN' } })) === 0,
    };
  }

  private registrationClosed(): never {
    throw new ConflictException({
      code: 'ADMIN_REGISTRATION_CLOSED',
      message: 'Un administrateur existe déjà. Connectez-vous avec vos accès.',
    });
  }

  async registerAdmin(dto: RegisterAdminDto, ip: string, requestId: string) {
    this.checkAttempts('ip:' + ip);
    if (!(await this.registrationStatus()).registrationOpen) this.registrationClosed();
    const passwordHash = await hashInitialPassword(dto.password);
    const result = await this.db.prisma.$transaction(async (tx) => {
      // Même verrou que le bootstrap terminal : une seule initialisation, même en concurrence.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726384901)`;
      if (await tx.user.count({ where: { role: 'SUPER_ADMIN' } })) this.registrationClosed();
      const normalized = dto.email.trim().normalize('NFKC').toLocaleLowerCase('en-US');
      if (
        await tx.user.findUnique({ where: { loginNormalized: normalized }, select: { id: true } })
      )
        throw new ConflictException({
          code: 'LOGIN_UNAVAILABLE',
          message: 'Cette adresse ne peut pas être utilisée.',
        });
      const user = await tx.user.create({
        data: {
          loginIdentifier: dto.email.trim(),
          loginNormalized: normalized,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          role: 'SUPER_ADMIN',
          mustChangePassword: false,
        },
      });
      await tx.syncScope.createMany({ data: [{ key: 'GLOBAL' }], skipDuplicates: true });
      const session = await this.startSession(tx, user, dto, requestId);
      await this.events.record(tx, {
        actorId: user.id,
        actorRole: user.role,
        action: 'ADMIN_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        deviceId: dto.deviceId,
        afterValue: { loginIdentifier: user.loginIdentifier },
        outcome: 'SUCCESS',
        requestId,
      });
      return session;
    }, transactionOptions);
    return {
      ...(await this.issue(result.user, result.session)),
      refresh: result.refresh,
      expiresAt: result.expiresAt,
    };
  }

  async login(dto: LoginDto, ip: string, requestId: string) {
    const normalized = dto.login.trim().normalize('NFKC').toLocaleLowerCase('en-US');
    this.checkAttempts('ip:' + ip);
    this.checkAttempts('login:' + digest(normalized));
    const user = await this.db.prisma.user.findUnique({
      where: { loginNormalized: normalized },
      include: { department: true },
    });
    const valid = await verifyPasswordHash(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (
      !valid ||
      !user ||
      (dto.portal !== undefined && user.role !== dto.portal) ||
      user.status !== 'ACTIVE' ||
      (user.initialPasswordExpiresAt && user.initialPasswordExpiresAt < new Date()) ||
      (user.role === 'MANAGER' && user.department?.status !== 'ACTIVE')
    ) {
      await this.db.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'Authentication',
          outcome: 'DENIED',
          requestId,
        },
      });
      throw new UnauthorizedException();
    }
    const result = await this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { department: true },
      });
      if (
        fresh.passwordHash !== user.passwordHash ||
        fresh.status !== 'ACTIVE' ||
        (dto.portal !== undefined && fresh.role !== dto.portal) ||
        (fresh.role === 'MANAGER' && fresh.department?.status !== 'ACTIVE')
      )
        throw new UnauthorizedException();
      return this.startSession(tx, fresh, dto, requestId);
    }, transactionOptions);
    this.attempts.delete('login:' + digest(normalized));
    return {
      ...(await this.issue(result.user, result.session)),
      refresh: result.refresh,
      expiresAt: result.expiresAt,
    };
  }

  private async startSession(
    tx: Prisma.TransactionClient,
    user: User,
    dto: Pick<LoginDto, 'deviceId' | 'deviceLabel'>,
    requestId: string,
  ) {
    const existing = await tx.device.findUnique({ where: { id: dto.deviceId } });
    if (existing && (existing.userId !== user.id || existing.status !== 'ACTIVE'))
      throw new UnauthorizedException();
    const now = new Date();
    const revoked = await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    const refresh = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + lifetime);
    const unusual = !existing && (await tx.device.count({ where: { userId: user.id } })) > 0;
    await tx.device.upsert({
      where: { id: dto.deviceId },
      create: {
        id: dto.deviceId,
        userId: user.id,
        label: dto.deviceLabel,
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date(), label: dto.deviceLabel },
    });
    if (revoked.count)
      await this.events.record(tx, {
        actorId: user.id,
        actorRole: user.role,
        departmentId: user.departmentId,
        deviceId: dto.deviceId,
        action: 'PREVIOUS_SESSIONS_REVOKED',
        entityType: 'User',
        entityId: user.id,
        outcome: 'SUCCESS',
        requestId,
        afterValue: { reason: 'NEW_LOGIN', revokedSessions: revoked.count },
      });
    const created = await tx.session.create({
      data: {
        userId: user.id,
        deviceId: dto.deviceId,
        credentialVersion: user.credentialVersion,
        authzVersion: user.authzVersion,
        expiresAt,
      },
    });
    await tx.refreshToken.create({
      data: { sessionId: created.id, tokenHash: digest(refresh), expiresAt },
    });
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), version: { increment: 1 } },
    });
    await this.events.record(tx, {
      actorId: user.id,
      actorRole: user.role,
      departmentId: user.departmentId,
      deviceId: dto.deviceId,
      action: 'LOGIN_SUCCEEDED',
      ...(existing && existing.label !== dto.deviceLabel
        ? {
            beforeValue: { deviceLabel: existing.label },
            afterValue: { deviceLabel: dto.deviceLabel },
          }
        : {}),
      entityType: 'Session',
      entityId: created.id,
      outcome: 'SUCCESS',
      requestId,
    });
    if (unusual)
      await this.events.record(tx, {
        actorId: user.id,
        actorRole: user.role,
        departmentId: user.departmentId,
        deviceId: dto.deviceId,
        action: 'UNUSUAL_LOGIN',
        entityType: 'Session',
        entityId: created.id,
        outcome: 'SUCCESS',
        requestId,
        afterValue: { reason: 'NEW_DEVICE' },
      });
    return { session: created, user: updatedUser, refresh, expiresAt };
  }

  private async issue(user: User, session: Session) {
    return {
      accessToken: await this.jwt.signAsync(
        { sub: user.id, sid: session.id },
        {
          secret: this.jwtSecret,
          algorithm: 'HS256',
          issuer: 'suivi',
          audience: 'suivi-web',
          expiresIn: '10m',
        },
      ),
      user: safeUser(user),
    };
  }

  async validateSession(userId: string, sessionId: string): Promise<Principal> {
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(sessionId))
      throw new UnauthorizedException();
    const session = await this.db.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { department: true } }, device: true },
    });
    if (!session || session.userId !== userId || !this.valid(session))
      throw new UnauthorizedException();
    return {
      id: session.userId,
      sessionId,
      deviceId: session.deviceId,
      role: session.user.role,
      departmentId: session.user.departmentId,
      mustChangePassword: session.user.mustChangePassword,
      credentialVersion: session.credentialVersion,
      authzVersion: session.authzVersion,
    };
  }
  private valid(
    session: Session & {
      user: User & { department: { status: string } | null };
      device: { status: string };
    },
  ) {
    return (
      !session.revokedAt &&
      session.expiresAt > new Date() &&
      session.user.status === 'ACTIVE' &&
      session.device.status === 'ACTIVE' &&
      session.credentialVersion === session.user.credentialVersion &&
      session.authzVersion === session.user.authzVersion &&
      (!session.user.initialPasswordExpiresAt ||
        session.user.initialPasswordExpiresAt > new Date()) &&
      (session.user.role !== 'MANAGER' || session.user.department?.status === 'ACTIVE')
    );
  }

  async refresh(value: string | undefined, requestId: string) {
    if (!value || !/^[A-Za-z0-9_-]{64}$/.test(value)) throw new UnauthorizedException();
    const result = await this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM refresh_tokens WHERE token_hash=${digest(value)} FOR UPDATE`;
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash: digest(value) },
        include: {
          session: { include: { user: { include: { department: true } }, device: true } },
        },
      });
      if (!token) return null;
      const session = token.session;
      if (token.consumedAt) {
        await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        await this.events.record(tx, {
          actorId: session.userId,
          actorRole: session.user.role,
          departmentId: session.user.departmentId,
          deviceId: session.deviceId,
          action: 'REFRESH_REUSE_DETECTED',
          entityType: 'Session',
          entityId: session.id,
          outcome: 'DENIED',
          requestId,
        });
        return null;
      }
      if (token.expiresAt <= new Date() || !this.valid(session)) return null;
      const refresh = randomBytes(48).toString('base64url');
      await tx.refreshToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
      await tx.refreshToken.create({
        data: { sessionId: session.id, tokenHash: digest(refresh), expiresAt: session.expiresAt },
      });
      return {
        ...(await this.issue(session.user, session)),
        refresh,
        expiresAt: session.expiresAt,
      };
    }, transactionOptions);
    if (!result) throw new UnauthorizedException();
    return result;
  }

  async profile(user: Principal) {
    return safeUser(await this.db.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }
  async logout(user: Principal, requestId: string) {
    await this.db.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: user.sessionId, userId: user.id },
        data: { revokedAt: new Date() },
      });
      await this.events.record(tx, {
        actorId: user.id,
        actorRole: user.role,
        departmentId: user.departmentId,
        deviceId: user.deviceId,
        action: 'SESSION_REVOKED',
        entityType: 'Session',
        entityId: user.sessionId,
        outcome: 'SUCCESS',
        requestId,
      });
    }, transactionOptions);
  }
  async changePassword(user: Principal, dto: ChangePasswordDto, requestId: string) {
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'Choisissez un nouveau mot de passe différent du précédent.',
      });
    const current = await this.db.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPasswordHash(current.passwordHash, dto.currentPassword)))
      throw new UnauthorizedException();
    const hash = await hashInitialPassword(dto.newPassword);
    await this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (
        fresh.passwordHash !== current.passwordHash ||
        fresh.credentialVersion !== user.credentialVersion ||
        fresh.status !== 'ACTIVE'
      )
        throw new UnauthorizedException();
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          mustChangePassword: false,
          initialPasswordExpiresAt: null,
          credentialVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.events.record(tx, {
        actorId: user.id,
        actorRole: user.role,
        departmentId: user.departmentId,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user.id,
        outcome: 'SUCCESS',
        requestId,
        deviceId: user.deviceId,
      });
    }, transactionOptions);
  }

  async lockIdentity(tx: Prisma.TransactionClient, actor: Principal) {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM sessions WHERE id=${actor.sessionId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM devices WHERE id=${actor.deviceId}::uuid FOR SHARE`;
    const session = await tx.session.findUnique({
      where: { id: actor.sessionId },
      include: { user: { include: { department: true } }, device: true },
    });
    if (
      !session ||
      !this.valid(session) ||
      session.user.mustChangePassword ||
      session.user.authzVersion !== actor.authzVersion
    )
      throw new UnauthorizedException();
  }
}
