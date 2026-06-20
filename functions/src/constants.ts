export const DEVICE_COLLECTION = 'deviceTokens';
export const SYSTEM_HEALTH_COLLECTION = 'system';
export const NOTIFICATION_HEALTH_DOC_ID = 'notification-health';
export const NOTIFICATION_HEALTH_STALE_MS = 6 * 60 * 1000;
export const COOLDOWN_COLLECTION = 'notification-cooldowns';
export const AIRCRAFT_SNAPSHOTS_COLLECTION = 'aircraft-snapshots';
export const MILITARY_HISTORY_COLLECTION = 'military-history';
export const DEFAULT_RADIUS_KM = 100;
export const MIN_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 200;
export const MAX_NOTIFICATIONS_PER_DEVICE = 2;
export const RECENT_NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** Stale lock TTL — must exceed worst-case processPlanes runtime. */
export const PROCESS_PLANES_LOCK_TTL_MS = 10 * 60 * 1000;
/** Snapshots older than this are refetched during notification processing. */
export const AIRCRAFT_SNAPSHOT_MAX_AGE_MS = 4 * 60 * 1000;

// Special aircraft ICAO codes (Air Force One, etc.)
export const SPECIAL_ICAOS = ['a13435', 'adfdf8', 'adfdf9']; // Add more as needed

export const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL?.trim() || 'https://planes.dryl.io';
export const ORIGIN_HEADER =
  `PlaneAlertCloudFunction/1.0 (+${FRONTEND_BASE_URL})`;
