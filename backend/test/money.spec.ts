import { money, financialProgress, calendarDate } from '../src/common/money.js';
import { databaseErrorCodes } from '../src/common/database-errors.js';

describe('Montants exacts et calendrier', () => {
  it('conserve les limites entières sans arrondir au-delà de Number.MAX_SAFE_INTEGER', () => {
    expect(money('9007199254740993')).toBe(9007199254740993n);
    expect(money('9223372036854775807')).toBe(9223372036854775807n);
    for (const value of ['0', '-1', '1.5', '1e6', ' 100', '01', '9223372036854775808'])
      expect(() => money(value)).toThrow();
  });
  it('calcule reste nul et dépassement sans multiplier l’objectif', () => {
    expect(financialProgress(10000000n, 12000000n)).toEqual({
      targetAmount: '10000000',
      totalAmount: '12000000',
      remainingAmount: '0',
      exceededAmount: '2000000',
      percentage: '120.00',
    });
    expect(financialProgress(3n, 1n).percentage).toBe('33.33');
    expect(financialProgress(100n, 0n).remainingAmount).toBe('100');
  });
  it('rattache une date au fuseau de la campagne plutôt qu’à celui du serveur', () => {
    const instant = new Date('2026-11-15T00:30:00Z');
    expect(calendarDate(instant, 'UTC')).toBe('2026-11-15');
    expect(calendarDate(instant, 'America/New_York')).toBe('2026-11-14');
  });
  it('extrait seulement les codes SQL structurés et borne la récursion', () => {
    const error = {
      code: 'P2010',
      meta: {
        driverAdapterError: { cause: { originalCode: '23505', message: 'secret-never-inspect' } },
      },
    };
    expect(databaseErrorCodes(error)).toEqual(['P2010', '23505']);
    const cycle: { cause?: unknown } = {};
    cycle.cause = cycle;
    expect(databaseErrorCodes(cycle)).toEqual([]);
  });
});
