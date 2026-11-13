import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createApp } from './create-app.js';
import type { Environment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }), config.get('HOST', { infer: true }));
}

void bootstrap().catch(() => {
  Logger.error('Échec du démarrage. Vérifier la configuration du serveur.', 'Bootstrap');
  process.exitCode = 1;
});
