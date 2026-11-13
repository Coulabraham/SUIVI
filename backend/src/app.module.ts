import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessModule } from './common/business.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { UsersModule } from './users/users.module.js';
import { MembersModule } from './members/members.module.js';
import { ObjectivesModule } from './objectives/objectives.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditModule } from './audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../.env'),
      validate: validateEnvironment,
      expandVariables: false,
    }),
    DatabaseModule,
    AuthModule,
    BusinessModule,
    DepartmentsModule,
    UsersModule,
    MembersModule,
    ObjectivesModule,
    PaymentsModule,
    DashboardModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
