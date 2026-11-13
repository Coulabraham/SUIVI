import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp, createOpenApiDocument } from './create-app.js';

async function exportDocument(): Promise<void> {
  const app = await createApp();
  try {
    await writeFile(
      resolve(process.cwd(), '../documentation/api/openapi.json'),
      `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`,
    );
  } finally {
    await app.close();
  }
}

void exportDocument().catch(() => {
  console.error('La génération OpenAPI a échoué.');
  process.exitCode = 1;
});
