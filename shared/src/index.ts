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
  normalizeCallsign,
  isMilitaryCallsign,
  isMilitaryOperator,
  BORING_AIRCRAFT_TYPES,
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
