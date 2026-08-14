const BERLIN = 'Europe/Berlin';

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinCalendarDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function sameBerlinCalendarDay(a: number, b: number): boolean {
  return berlinCalendarDay(a) === berlinCalendarDay(b);
}
