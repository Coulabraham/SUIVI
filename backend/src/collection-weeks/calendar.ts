export interface CalendarWeek {
  number: number;
  startsOn: Date;
  endsOn: Date;
  collectionOn: Date | null;
}

function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date attendue au format YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Date de calendrier invalide.');
  }
  return date;
}

/** Convention dimanche–samedi, explicitement réservée aux fixtures tant que Q05 reste ouverte. */
export function sundayCalendar(startsOn: string, endsOn: string): CalendarWeek[] {
  const first = dateOnly(startsOn);
  const last = dateOnly(endsOn);
  if (first > last) throw new Error('La fin précède le début de campagne.');
  const weeks: CalendarWeek[] = [];
  let cursor = first;
  while (cursor <= last) {
    const remaining = 6 - cursor.getUTCDay();
    const end = new Date(Math.min(last.getTime(), cursor.getTime() + remaining * 86400000));
    weeks.push({
      number: weeks.length + 1,
      startsOn: cursor,
      endsOn: end,
      collectionOn: cursor.getUTCDay() === 0 ? cursor : null,
    });
    cursor = new Date(end.getTime() + 86400000);
  }
  return weeks;
}
