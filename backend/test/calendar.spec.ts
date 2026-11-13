import { sundayCalendar } from '../src/collection-weeks/calendar.js';

describe('Calendrier de collecte', () => {
  it('couvre les dates réelles et les périodes partielles sans imposer 52 semaines', () => {
    const weeks = sundayCalendar('2026-01-01', '2026-12-31');
    expect(weeks).toHaveLength(53);
    expect(weeks[0]?.collectionOn).toBeNull();
    expect(weeks[0]?.endsOn.toISOString().slice(0, 10)).toBe('2026-01-03');
    expect(weeks.at(-1)?.endsOn.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('conserve le 29 février et un dimanche de fin', () => {
    const weeks = sundayCalendar('2024-02-29', '2024-03-03');
    expect(weeks).toHaveLength(2);
    expect(weeks[1]?.collectionOn?.toISOString().slice(0, 10)).toBe('2024-03-03');
  });

  it('refuse les dates impossibles et les bornes inversées', () => {
    expect(() => sundayCalendar('2026-02-30', '2026-03-10')).toThrow();
    expect(() => sundayCalendar('2026-03-10', '2026-03-01')).toThrow();
  });
});
