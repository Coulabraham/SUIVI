import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, LoginDto, RegisterAdminDto } from './auth.dto.js';
import { AllowPasswordChange, JwtGuard, PermissionsGuard } from './permissions.js';
import type { AuthenticatedRequest } from './auth.types.js';
import {
  ApiEnvelope,
  AuthResultDto,
  UserDto,
  PasswordChangedDto,
  SessionRevokedDto,
  RegistrationStatusDto,
} from '../common/response.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private checkOrigin(req: Request) {
    if (
      req.headers['x-suivi-client'] !== 'web' ||
      (req.headers.origin && req.headers.origin !== this.config.get<string>('FRONTEND_ORIGIN'))
    )
      throw new ForbiddenException();
  }
  private cookie(res: Response, value: string, expires: Date) {
    res.cookie('suivi_refresh', value, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      expires,
    });
  }
  private clear(res: Response) {
    res.clearCookie('suivi_refresh', {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  }

  @ApiOperation({ summary: 'Indique si le premier administrateur peut être créé' })
  @ApiEnvelope(RegistrationStatusDto)
  @Get('registration-status')
  async registrationStatus() {
    return { data: await this.auth.registrationStatus() };
  }

  @ApiOperation({ summary: 'Créer le premier administrateur ; fermé après initialisation' })
  @ApiEnvelope(AuthResultDto, 201)
  @Post('register-admin')
  async registerAdmin(
    @Body() dto: RegisterAdminDto,
    @Req() req: Request & { requestId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    const result = await this.auth.registerAdmin(dto, req.ip ?? 'unknown', req.requestId);
    this.cookie(res, result.refresh, result.expiresAt);
    return { data: { accessToken: result.accessToken, user: result.user } };
  }

  @ApiOperation({ summary: 'Connexion en ligne avec appareil explicite' })
  @ApiEnvelope(AuthResultDto)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request & { requestId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    const result = await this.auth.login(dto, req.ip ?? 'unknown', req.requestId);
    this.cookie(res, result.refresh, result.expiresAt);
    return { data: { accessToken: result.accessToken, user: result.user } };
  }
  @ApiOperation({ summary: 'Rotation du refresh ; réutilisation révoquant la session' })
  @ApiEnvelope(AuthResultDto)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request & { requestId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    try {
      const result = await this.auth.refresh(
        (req.cookies as Record<string, string | undefined> | undefined)?.suivi_refresh,
        req.requestId,
      );
      this.cookie(res, result.refresh, result.expiresAt);
      return { data: { accessToken: result.accessToken, user: result.user } };
    } catch (error) {
      this.clear(res);
      throw error;
    }
  }
  @ApiOperation({ summary: 'Profil courant sans données de sécurité' })
  @ApiEnvelope(UserDto)
  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @AllowPasswordChange()
  async profile(@Req() req: AuthenticatedRequest) {
    return { data: await this.auth.profile(req.user) };
  }

  @ApiOperation({ summary: 'Révoquer la session courante' })
  @ApiEnvelope(SessionRevokedDto)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @AllowPasswordChange()
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    await this.auth.logout(req.user, req.requestId);
    this.clear(res);
    return { data: { revoked: true } };
  }
  @ApiOperation({ summary: 'Changer le secret et révoquer toutes les sessions' })
  @ApiEnvelope(PasswordChangedDto)
  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtGuard, PermissionsGuard)
  @AllowPasswordChange()
  async change(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    await this.auth.changePassword(req.user, dto, req.requestId);
    this.clear(res);
    return { data: { changed: true } };
  }
}
