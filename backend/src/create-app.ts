import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ApiErrorFilter } from './common/api-error.filter.js';
import { JsonInterceptor } from './common/json.interceptor.js';
import type { Environment } from './config/environment.js';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.use((request: Request & { requestId: string }, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalInterceptors(new JsonInterceptor());
}

export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SUIVI — API REST')
      .setDescription('API métier SUIVI ; montants transmis en chaînes décimales entières FCFA.')
      .addBearerAuth()
      .setVersion('0.1.0')
      .build(),
  );
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService<Environment, true>);
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN', { infer: true }), credentials: true });
  if (config.get('API_DOCS_ENABLED', { infer: true })) {
    SwaggerModule.setup('api/v1/docs', app, createOpenApiDocument(app));
  }
  app.enableShutdownHooks();
  return app;
}
