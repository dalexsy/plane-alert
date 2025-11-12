/**
 * @plane-alert/shared
 *
 * Shared aircraft detection and classification logic
 * for Plane Alert frontend and backend systems
 */
export type { CountryDetectionResult, IcaoCountryRange, AdsBPlane, } from './types';
export { getCountryFromIcaoHex, getCountryFromRegistration, getAircraftCountry, getRegistrationPrefixesForCountry, isKnownCountry, ICAO_LOOKUP_CONFIG, } from './country-detection';
export { looksMilitary, normalizeCallsign, isMilitaryCallsign, isMilitaryOperator, BORING_AIRCRAFT_TYPES, MIL_CALLSIGN_PREFIXES, MIL_OPERATOR_KEYWORDS, } from './military-detection';
export { toRadians, toDegrees, haversineDistanceKm, computeBearing, bearingToCardinal, formatDistance, } from './geo-utils';
export { formatNotificationBody, getArrowForDirection, getCountryFlagEmoji, } from './notification-formatter';
export type { NotificationData } from './notification-formatter';
export { createAircraftLookupMap, isAircraftMilitary, isMilitaryAircraft, } from './aircraft-db-loader';
export type { AircraftDbEntry, AircraftDbMetadata } from './aircraft-db-loader';
//# sourceMappingURL=index.d.ts.map