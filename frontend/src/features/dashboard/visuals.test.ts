import { describe, expect, it } from 'vitest';
import { chartValues } from './chart-values';

describe('Représentation graphique des montants FCFA', () => {
  it('préserve le montant exact au-delà des entiers JavaScript et ne convertit que la géométrie', () => {
    const result = chartValues([
      { totalAmount: '9007199254740993' },
      { totalAmount: '4503599627370496' },
    ]);
    expect(result[0]).toEqual({ totalAmount: '9007199254740993', value: 100 });
    expect(result[1]?.totalAmount).toBe('4503599627370496');
    expect(result[1]?.value).toBe(49.99);
  });
  it('gère une campagne vide sans division par zéro ni valeur non finie', () => {
    expect(chartValues([])).toEqual([]);
    expect(chartValues([{ totalAmount: '0' }], 0n)).toEqual([{ totalAmount: '0', value: 0 }]);
  });
});
