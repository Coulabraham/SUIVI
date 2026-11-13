import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtGuard, PermissionsGuard } from './permissions.js';
import { EventsModule } from '../events/events.module.js';

@Global()
@Module({
  imports: [DatabaseModule, EventsModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtGuard, PermissionsGuard],
  exports: [AuthService, JwtGuard, PermissionsGuard],
})
export class AuthModule {}
