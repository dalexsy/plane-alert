import { isKioskMode } from '../kiosk-mode/kiosk-mode.util';

/** Local civil time on the kiosk (Berlin). Quiet = no MP3 alerts. */
export const KIOSK_QUIET_TZ = 'Europe/Berlin';
/** Quiet overnight: from 22:00 inclusive until 07:00 exclusive. */
export const KIOSK_QUIET_START_HOUR = 22;
export const KIOSK_QUIET_END_HOUR = 7;

/** True when kiosk should stay silent (22:00 ≤ hour or hour < 07:00). */
export function isKioskQuietHours(now: Date = new Date()): boolean {
  if (!isKioskMode()) return false;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: KIOSK_QUIET_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now)
  );
  return hour >= KIOSK_QUIET_START_HOUR || hour < KIOSK_QUIET_END_HOUR;
}
