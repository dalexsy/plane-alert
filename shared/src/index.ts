/**
 * @plane-alert/shared
 *
 * Shared aircraft detection and classification logic
 * for Plane Alert frontend and backend systems
 */

// Export types
export type {
  CountryDetectionResult,
  IcaoCountryRange,
  AdsBPlane,
} from './types';

// Export country detection functions
export {
  getCountryFromIcaoHex,
  getCountryFromRegistration,
  getAircraftCountry,
  getRegistrationPrefixesForCountry,
  isKnownCountry,
  ICAO_LOOKUP_CONFIG,
} from './country-detection';

// Export military detection functions
export {
  looksMilitary,
  isBoringMilitaryAircraft,
  normalizeCallsign,
  isMilitaryCallsign,
  isBoringMilitaryCallsign,
  isMilitaryOperator,
  shouldSkipBoringMilitaryFilter,
  BORING_AIRCRAFT_TYPES,
  BORING_MIL_CALLSIGN_PREFIXES,
  MIL_CALLSIGN_PREFIXES,
  MIL_OPERATOR_KEYWORDS,
} from './military-detection';

// Export geo utilities
export {
  toRadians,
  toDegrees,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  formatDistance,
} from './geo-utils';

// Export notification formatting
export {
  formatNotificationBody,
  formatNotificationTitle,
  getArrowForDirection,
  getCountryFlagEmoji,
} from './notification-formatter';
export type { NotificationData } from './notification-formatter';

// Export aircraft database utilities
export {
  createAircraftLookupMap,
  isAircraftMilitary,
  isMilitaryAircraft,
} from './aircraft-db-loader';
export type { AircraftDbEntry, AircraftDbMetadata } from './aircraft-db-loader';

// Export military types for filtering
export { COMMON_MILITARY_TYPES } from './military-types';
export type { MilitaryAircraftType } from './military-types';

// Export aircraft type name mapping
export {
  AIRCRAFT_TYPE_NAMES,
  getAircraftTypeName,
} from './aircraft-type-names';
export type { AircraftTypeName } from './aircraft-type-names';

// Household Pushover defaults (client + Pi backend)
export {
  PUSHOVER_USER_KEY,
  DEFAULT_PUSH_HOME,
  DEFAULT_PUSH_DEVICE_NAMES,
} from './pushover-defaults';

// Pushover device matching (client + Cloud Functions)
export {
  PUSHOVER_UNRELIABLE_DEVICE_NAMES,
  autoMatchPushoverDevice,
  matchPushoverDeviceName,
  resolvePushoverDeliveryTarget,
  isValidDeviceRegistration,
} from './pushover-device-match';
export type { PushoverDeviceMatchInput } from './pushover-device-match';
