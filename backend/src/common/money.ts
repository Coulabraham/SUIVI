import { BadRequestException } from '@nestjs/common';

export function money(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
    throw new BadRequestException({
      code: 'INVALID_AMOUNT',
      message: 'Saisissez un montant entier positif en FCFA, compatible avec BIGINT.',
    });
  return BigInt(value);
}
export function financialProgress(target: bigint, total: bigint) {
  if (target <= 0n) throw new Error('Objectif positif requis.');
  const hundredths = (total * 10000n) / target;
  return {
    targetAmount: target.toString(),
    totalAmount: total.toString(),
    remainingAmount: (target > total ? target - total : 0n).toString(),
    exceededAmount: (total > target ? total - target : 0n).toString(),
    percentage:
      (hundredths / 100n).toString() + '.' + (hundredths % 100n).toString().padStart(2, '0'),
  };
}
export function calendarDate(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return get('year') + '-' + get('month') + '-' + get('day');
}
