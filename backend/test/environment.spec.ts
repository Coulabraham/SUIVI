import 'reflect-metadata';
import { validateEnvironment } from '../src/config/environment.js';

const databaseUrl = 'postgresql://test_user:test_password@127.0.0.1:5433/suivi_test';

describe('Configuration serveur', () => {
  it('valide et convertit les paramètres attendus', () => {
    const config = validateEnvironment({
      DATABASE_URL: databaseUrl,
      PORT: '3101',
      API_DOCS_ENABLED: 'false',
    });
    expect(config.PORT).toBe(3101);
    expect(config.API_DOCS_ENABLED).toBe(false);
  });

  it('refuse une base absente et un port invalide sans afficher les secrets', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'GENERER_UN_SECRET_ALEATOIRE_AVEC_SETUP_ENV',
      }),
    ).toThrow('AUTH_JWT_SECRET');
    expect(() => validateEnvironment({ PORT: '-1', DATABASE_URL: 'secret_invalid_url' })).toThrow(
      'DATABASE_URL',
    );
    expect(() =>
      validateEnvironment({ PORT: '-1', DATABASE_URL: 'secret_invalid_url' }),
    ).not.toThrow('secret_invalid_url');
  });

  it('refuse un booléen de configuration ambigu', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: databaseUrl, API_DOCS_ENABLED: 'maybe' }),
    ).toThrow('API_DOCS_ENABLED');
  });

  it('refuse Swagger et une origine HTTP en production', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        API_DOCS_ENABLED: 'true',
      }),
    ).toThrow('Swagger');
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'http://example.test',
      }),
    ).toThrow('HTTPS');
  });
});
