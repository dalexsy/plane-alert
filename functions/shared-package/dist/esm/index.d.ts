/**
 * @plane-alert/shared
 *
 * Shared aircraft detection and classification logic
 * for Plane Alert frontend and backend systems
 */
export type { CountryDetectionResult, IcaoCountryRange, AdsBPlane, } from './types';
export { getCountryFromIcaoHex, getCountryFromRegistration, getAircraftCountry, getRegistrationPrefixesForCountry, isKnownCountry, ICAO_LOOKUP_CONFIG, } from './country-detection';
export { looksMilitary, isBoringMilitaryAircraft, normalizeCallsign, isMilitaryCallsign, isMilitaryOperator, shouldSkipBoringMilitaryFilter, BORING_AIRCRAFT_TYPES, MIL_CALLSIGN_PREFIXES, MIL_OPERATOR_KEYWORDS, } from './military-detection';
export { toRadians, toDegrees, haversineDistanceKm, computeBearing, bearingToCardinal, formatDistance, } from './geo-utils';
export { formatNotificationBody, formatNotificationTitle, getArrowForDirection, getCountryFlagEmoji, } from './notification-formatter';
export type { NotificationData } from './notification-formatter';
export { createAircraftLookupMap, isAircraftMilitary, isMilitaryAircraft, } from './aircraft-db-loader';
export type { AircraftDbEntry, AircraftDbMetadata } from './aircraft-db-loader';
export { COMMON_MILITARY_TYPES } from './military-types';
export type { MilitaryAircraftType } from './military-types';
export { AIRCRAFT_TYPE_NAMES, getAircraftTypeName, } from './aircraft-type-names';
export type { AircraftTypeName } from './aircraft-type-names';
export { PUSHOVER_UNRELIABLE_DEVICE_NAMES, autoMatchPushoverDevice, matchPushoverDeviceName, resolvePushoverDeliveryTarget, isValidDeviceRegistration, } from './pushover-device-match';
export type { PushoverDeviceMatchInput } from './pushover-device-match';
//# sourceMappingURL=index.d.ts.map