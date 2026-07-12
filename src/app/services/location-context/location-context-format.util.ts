import type { TimezoneData } from './location-context.types';
import { getCurrentTimeForTimezone } from './location-context.util';

export function formatTimeForTimezone(
  timezone: TimezoneData | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  return getCurrentTimeForTimezone(timezone).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  });
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
