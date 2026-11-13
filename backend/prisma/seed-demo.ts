import type { runSeedCli } from '../src/database/seed-runner.js';

const compiled: { runSeedCli: typeof runSeedCli } = await import(
  new URL('../dist/database/seed-runner.js', import.meta.url).href
);
await compiled.runSeedCli('demo');
