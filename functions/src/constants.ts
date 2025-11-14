export const DEVICE_COLLECTION = 'deviceTokens';
export const COOLDOWN_COLLECTION = 'notification-cooldowns';
export const AIRCRAFT_SNAPSHOTS_COLLECTION = 'aircraft-snapshots';
export const DEFAULT_RADIUS_KM = 100;
export const MIN_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 200;
export const MAX_NOTIFICATIONS_PER_DEVICE = 2;
export const RECENT_NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Special aircraft ICAO codes (Air Force One, etc.)
export const SPECIAL_ICAOS = ['a13435', 'adfdf8', 'adfdf9']; // Add more as needed

export const ORIGIN_HEADER =
  'PlaneAlertCloudFunction/1.0 (+https://plane-alert.surge.sh)';
