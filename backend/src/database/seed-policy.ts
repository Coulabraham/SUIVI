export function assertDemoDatabaseName(name: string, mode: string | undefined): void {
  if (mode === 'production' || !/^suivi_(demo|test_[a-z0-9_]+)$/.test(name)) {
    throw new Error(
      'Démonstration refusée : une base dédiée suivi_demo/suivi_test_* hors production est obligatoire.',
    );
  }
}

export function assertDemoTarget(
  connectionString: string,
  mode: string | undefined,
  allowed: string | undefined,
): void {
  assertDemoDatabaseName(new URL(connectionString).pathname.slice(1), mode);
  if (allowed !== 'true')
    throw new Error('Démonstration refusée : ALLOW_DEMO_SEED=true est obligatoire.');
}
