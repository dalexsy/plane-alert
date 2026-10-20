import type { TimezoneData } from './location-context.types';
import { getCurrentTimeForTimezone } from './location-context.util';

export function formatTimeForTimezone(
  timezone: TimezoneData | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const base: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    ...options,
  };
  if (timezone?.timezone?.includes('/')) {
    return new Intl.DateTimeFormat('en-GB', {
      ...base,
      timeZone: timezone.timezone,
    }).format(new Date());
  }
  return getCurrentTimeForTimezone(timezone).toLocaleTimeString('en-GB', base);
}

export function formatDateForTimezone(
  timezone: TimezoneData | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  return getCurrentTimeForTimezone(timezone).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  });
}
