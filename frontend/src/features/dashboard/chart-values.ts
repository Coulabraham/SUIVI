/** Seule la géométrie est normalisée ; les montants exacts restent des chaînes FCFA. */
export function chartValues<T extends { totalAmount: string }>(rows: T[], denominator?: bigint) {
  const maximum =
    denominator ??
    rows.reduce((max, row) => (BigInt(row.totalAmount) > max ? BigInt(row.totalAmount) : max), 1n);
  return rows.map((row) => ({
    ...row,
    value: maximum > 0n ? Number((BigInt(row.totalAmount) * 10000n) / maximum) / 100 : 0,
  }));
}
