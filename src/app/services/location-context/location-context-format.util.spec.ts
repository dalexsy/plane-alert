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

  it('uses CEST (UTC+2) in summer', () => {
    const at = new Date('2026-07-15T12:30:00.000Z');
    expect(formatTimeForTimezone(berlin, undefined, at)).toBe('14:30');
  });

  it('uses CET (UTC+1) in winter', () => {
    const at = new Date('2026-01-15T12:30:00.000Z');
    expect(formatTimeForTimezone(berlin, undefined, at)).toBe('13:30');
  });

  it('does not mimic en-US 12-hour strip (05:09 vs 17:09)', () => {
    const at = new Date('2026-10-20T15:09:00.000Z');
    const twelveHour = at.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const stripped = twelveHour.replace(/\s*AM|\s*PM/gi, '').trim();
    expect(stripped).toBe('05:09');
    expect(formatTimeForTimezone(berlin, undefined, at)).toBe('17:09');
  });
});
