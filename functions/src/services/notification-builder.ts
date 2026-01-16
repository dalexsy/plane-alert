import type { AdsBPlane } from '@plane-alert/shared';
import {
  normalizeCallsign,
  getAircraftCountry,
  getCountryFlagEmoji,
  formatNotificationBody,
} from '@plane-alert/shared';
import { reverseGeocode } from './geocoding';
import type { FlightData } from './aeroapi-client';
import { formatRoute, formatETA } from './aeroapi-client';

/**
 * Get operator from callsign
 */
export function getOperatorFromCallsign(callsign: string): string | null {
  if (!callsign) {
    return null;
  }

  const operatorMap: Record<string, string> = {
    GAF: 'Luftwaffe',
    SHADO: 'Luftwaffe',
    HUKR: 'Royal Air Force',
    RRR: 'Royal Air Force',
    ASCOT: 'Royal Air Force',
    TARTN: 'Royal Air Force',
    RCH: 'US Air Force',
    REACH: 'US Air Force',
    CNV: 'US Air Force',
    CONVOY: 'US Air Force',
    EVAC: 'US Air Force',
    SPAR: 'US Air Force',
    BOXER: 'US Air Force',
    SENTRY: 'US Air Force',
    DUKE: 'US Army',
    ARMY: 'US Army',
    MARINE: 'US Marine Corps',
    NAVY: 'US Navy',
    COAST: 'US Coast Guard',
    FF: 'French Air Force',
    CTM: 'French Air Force',
    FAF: 'French Air Force',
    EIDER: 'Royal Canadian Air Force',
    CFC: 'Royal Canadian Air Force',
    IAM: 'Italian Air Force',
    MM: 'Italian Air Force',
    NAF: 'Norwegian Armed Forces',
    RSAF: 'Republic of Singapore Air Force',
  };

  const normalized = callsign.trim().toUpperCase();

  if (operatorMap[normalized]) {
    return operatorMap[normalized];
  }

  const sortedPrefixes = Object.keys(operatorMap).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sortedPrefixes) {
    if (normalized.startsWith(prefix)) {
      return operatorMap[prefix];
    }
  }

  return null;
}

/**
 * Build notification body using shared formatter
 * v2: Updated notification format with location and bearings
 * v3: Added optional flight data (origin/destination/ETA)
 */
export async function buildNotificationBody(
  plane: AdsBPlane,
  distance: { value: number; unit: string },
  direction: string,
  bearing: number,
  distanceUnit: 'km' | 'miles',
  skipCallsignInBody = false,
  flightData?: FlightData | null
): Promise<string> {
  const callsign =
    normalizeCallsign(plane.flight || plane.callsign) ||
    plane.hex.toUpperCase();

  const countryResult = getAircraftCountry(plane.r, plane.hex, undefined, true);

  const countryCode =
    countryResult.countryCode !== 'Unknown' ? countryResult.countryCode : null;
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

  const operator = getOperatorFromCallsign(callsign);

  let speed: number | undefined;
  let speedUnit: 'mph' | 'km/h';
  if (plane.gs && plane.gs > 0) {
    if (distanceUnit === 'miles') {
      speed = Math.round(plane.gs * 1.15078);
      speedUnit = 'mph';
    } else {
      speed = Math.round(plane.gs * 1.852);
      speedUnit = 'km/h';
    }
  } else {
    speedUnit = distanceUnit === 'miles' ? 'mph' : 'km/h';
  }

  let altitude: number | undefined;
  let altitudeUnit: 'ft' | 'm';
  const altitudeFeet =
    typeof plane.alt_baro === 'number'
      ? plane.alt_baro
      : typeof plane.alt_geom === 'number'
      ? plane.alt_geom
      : null;

  if (altitudeFeet !== null && altitudeFeet > 0) {
    if (distanceUnit === 'miles') {
      altitude = altitudeFeet;
      altitudeUnit = 'ft';
    } else {
      altitude = Math.round(altitudeFeet * 0.3048);
      altitudeUnit = 'm';
    }
  } else {
    altitudeUnit = distanceUnit === 'miles' ? 'ft' : 'm';
  }

  // Format location - try reverse geocoding, omit if it fails
  let location: string | undefined;
  if (plane.lat !== undefined && plane.lon !== undefined) {
    const placeName = await reverseGeocode(plane.lat, plane.lon);
    if (placeName) {
      location = placeName; // Formatter adds "over" prefix
    }
  }

  // Format flight route and ETA if available
  let routeInfo: string | undefined;
  if (flightData) {
    const route = formatRoute(flightData);
    const eta = formatETA(flightData);
    if (route && eta) {
      routeInfo = `${route} (ETA ${eta})`;
    } else if (route) {
      routeInfo = route;
    }
  }

  return formatNotificationBody(
    {
      callsign,
      icao: plane.hex,
      direction,
      bearing,
      planeHeading: plane.track,
      flagEmoji,
      operator: operator || undefined,
      speed,
      speedUnit,
      altitude,
      altitudeUnit,
      verticalRate: plane.baro_rate || undefined,
      location,
      route: routeInfo,
    },
    skipCallsignInBody
  );
}
