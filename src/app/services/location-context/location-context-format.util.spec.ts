import { formatTimeForTimezone } from './location-context-format.util';

describe('formatTimeForTimezone', () => {
  const berlin: { timezone: string; utcOffset: number; dst: boolean } = {
    timezone: 'Europe/Berlin',
    utcOffset: 2,
    dst: false,
  };

  it('formats afternoon Berlin wall time in 24-hour h23 (not 12-hour AM)', () => {
    const at = new Date('2026-10-20T15:09:00.000Z');
    const formatted = formatTimeForTimezone(berlin, undefined, at);
    expect(formatted).toBe('17:09');
    expect(formatted).not.toMatch(/am|pm/i);
  });

  it('never returns bare 05:09 when Berlin afternoon is 17:09', () => {
    const at = new Date('2026-10-20T15:09:00.000Z');
    const formatted = formatTimeForTimezone(berlin, undefined, at);
    expect(formatted).not.toBe('05:09');
    const hour = Number.parseInt(formatted.slice(0, 2), 10);
    expect(hour).toBeGreaterThanOrEqual(12);
  });

  it('matches en-GB 24-hour pattern', () => {
    const formatted = formatTimeForTimezone(berlin);
    expect(formatted).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
