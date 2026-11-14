import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
if (
  !existsSync(new URL('backend/dist/main.js', root)) ||
  !existsSync(new URL('frontend/dist/sw.js', root))
) {
  console.error('Compiler SUIVI avec npm.cmd run build avant de lancer cet aperçu.');
  process.exit(1);
}
// Origine distincte du serveur Vite : cookies et stockage ne se mélangent pas
// avec la session de développement sur 127.0.0.1:5173.
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: '3001',
  FRONTEND_ORIGIN: 'http://localhost:4173',
  API_PROXY_TARGET: 'http://127.0.0.1:3001',
};
const services = [
  spawn(process.execPath, ['dist/main.js'], {
    cwd: fileURLToPath(new URL('backend/', root)),
    env,
    stdio: 'inherit',
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    [
      fileURLToPath(new URL('node_modules/vite/bin/vite.js', root)),
      'preview',
      '--host',
      'localhost',
      '--port',
      '4173',
    ],
    { cwd: fileURLToPath(new URL('frontend/', root)), env, stdio: 'inherit', windowsHide: true },
  ),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const service of services) if (service.exitCode === null) service.kill();
}
for (const service of services) {
  service.on('error', () => {
    console.error('Un service de l’aperçu PWA n’a pas pu démarrer.');
    stop(1);
  });
  service.on('exit', (code) => stop(code ?? 1));
}
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
console.log('Aperçu PWA local : http://localhost:4173/installation');
