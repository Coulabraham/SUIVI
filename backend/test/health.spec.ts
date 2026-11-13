import { jest } from '@jest/globals';
import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller.js';
import { DatabaseService } from '../src/database/database.service.js';
import { configureApp } from '../src/create-app.js';

@Controller('test-error')
class FaultController {
  @Get()
  fail(): never {
    throw new Error('test_secret_never_expose');
  }
}

describe('API de santé et erreurs HTTP', () => {
  let app: INestApplication;
  const database = { isReady: jest.fn(() => Promise.resolve(true)) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController, FaultController],
      providers: [{ provide: DatabaseService, useValue: database }],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond au préfixe versionné, sans détail interne', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(response.body).toEqual({
      data: { service: 'SUIVI', status: 'ok', checkedAt: expect.any(String) },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('vérifie la disponibilité de PostgreSQL', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(database.isReady).toHaveBeenCalled();
  });

  it('retourne 503 quand PostgreSQL est indisponible', async () => {
    database.isReady.mockResolvedValueOnce(false);
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('structure une route inconnue', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('ne divulgue pas une erreur interne', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/test-error').expect(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('test_secret_never_expose');
  });
});
