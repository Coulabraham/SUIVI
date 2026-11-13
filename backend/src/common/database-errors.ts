/** N'inspecte que les codes structurés ; les messages SQL et les valeurs ne sortent jamais de l'API. */
export function databaseErrorCodes(value: unknown, depth = 0): string[] {
  if (!value || typeof value !== 'object' || depth > 5) return [];
  const row = value as Record<string, unknown>;
  const timeout =
    value instanceof Error && value.message === 'Query read timeout' ? ['PG_QUERY_TIMEOUT'] : [];
  const codes = ['code', 'originalCode', 'sqlState', 'sqlstate'].flatMap((key) =>
    typeof row[key] === 'string' ? [row[key] as string] : [],
  );
  return timeout.concat(
    codes,
    ...['cause', 'meta', 'driverAdapterError', 'inner'].map((key) =>
      databaseErrorCodes(row[key], depth + 1),
    ),
  );
}
