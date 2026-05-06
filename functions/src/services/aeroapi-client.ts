/**
 * FlightAware AeroAPI Client
 * Fetches flight origin/destination/ETA data for aircraft callsigns
 */

import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { reverseGeocode } from './geocoding';

const AEROAPI_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

function safeErrorForLogging(error: unknown): {
  message?: string;
  name?: string;
  stack?: string;
  raw?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  try {
    return { raw: JSON.stringify(error) };
  } catch {
    return { raw: String(error) };
  }
}

export interface FlightData {
  ident: string;
  operator?: string;
  aircraftType?: string;
  registration?: string;
  origin?: AirportInfo;
  destination?: AirportInfo;
  scheduledOut?: string;
  estimatedOut?: string;
  actualOut?: string;
  scheduledOn?: string;
  estimatedOn?: string;
  actualOn?: string;
  scheduledIn?: string;
  estimatedIn?: string;
  actualIn?: string;
  status?: string;
  gate?: string;
  terminal?: string;
  routeDistance?: number;
  route?: string;
  diverted?: boolean;
  cancelled?: boolean;
  departureDelay?: number;
  arrivalDelay?: number;
}

export interface AirportInfo {
  code: string;
  codeIcao?: string;
  codeIata?: string;
  name?: string;
  city?: string;
  timezone?: string;
}

interface AeroApiResponse {
  flights?: Array<{
    ident?: string;
    ident_icao?: string;
    operator?: string;
    operator_icao?: string;
    flight_number?: string;
    registration?: string;
    aircraft_type?: string;
    origin?: {
      code?: string;
      code_icao?: string;
      code_iata?: string;
      name?: string;
      city?: string;
      timezone?: string;
    };
    destination?: {
      code?: string;
      code_icao?: string;
      code_iata?: string;
      name?: string;
      city?: string;
      timezone?: string;
    };
    scheduled_out?: string;
    estimated_out?: string;
    actual_out?: string;
    scheduled_off?: string;
    estimated_off?: string;
    actual_off?: string;
    scheduled_on?: string;
    estimated_on?: string;
    actual_on?: string;
    scheduled_in?: string;
    estimated_in?: string;
    actual_in?: string;
    status?: string;
    gate_destination?: string;
    terminal_destination?: string;
    route_distance?: number;
    route?: string;
    diverted?: boolean;
    cancelled?: boolean;
    departure_delay?: number;
    arrival_delay?: number;
    progress_percent?: number;
  }>;
}

/**
 * Fetch flight data from AeroAPI by callsign
 */
export async function fetchFlightData(
  callsign: string
): Promise<FlightData | null> {
  const apiKey = process.env.AEROAPI_KEY;
  if (!apiKey) {
    logger.warn('AEROAPI_KEY not configured, skipping flight data fetch');
    return null;
  }

  const cleanCallsign = callsign.trim().toUpperCase();
  if (!cleanCallsign) {
    return null;
  }

  try {
    const url = `${AEROAPI_BASE_URL}/flights/${cleanCallsign}`;
    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey,
        Accept: 'application/json',
      },
      timeout: 5000,
    } as any);

    if (!response.ok) {
      if (response.status === 404) {
        // Flight not found - this is normal for many aircraft (military, GA, etc.)
        logger.debug('No AeroAPI data for callsign', { callsign });
        return null;
      }
      logger.warn('AeroAPI request failed', {
        status: response.status,
        statusText: response.statusText,
        callsign,
      });
      return null;
    }

    const data = (await response.json()) as AeroApiResponse;

    if (!data.flights || data.flights.length === 0) {
      logger.debug('No flights returned from AeroAPI', { callsign });
      return null;
    }

    // Get the most recent/current flight (first in array)
    const flight = data.flights[0];

    // Extract and normalize flight data
    const flightData: FlightData = {
      ident: flight.ident || cleanCallsign,
      operator: flight.operator_icao || flight.operator,
      aircraftType: flight.aircraft_type,
      registration: flight.registration,
      origin: flight.origin
        ? (() => {
            const rawCode = flight.origin.code_icao || flight.origin.code || '';
            const isCoord = looksLikeCoordinate(rawCode);
            return {
              code: isCoord ? '' : rawCode,
              codeIcao: isCoord ? undefined : flight.origin.code_icao,
              codeIata: isCoord ? undefined : flight.origin.code_iata,
              name: flight.origin.name,
              city: flight.origin.city,
              timezone: flight.origin.timezone,
              _rawCoordCode: isCoord ? rawCode : undefined,
            } as AirportInfo & { _rawCoordCode?: string };
          })()
        : undefined,
      destination: flight.destination
        ? (() => {
            const rawCode = flight.destination.code_icao || flight.destination.code || '';
            const isCoord = looksLikeCoordinate(rawCode);
            return {
              code: isCoord ? '' : rawCode,
              codeIcao: isCoord ? undefined : flight.destination.code_icao,
              codeIata: isCoord ? undefined : flight.destination.code_iata,
              name: flight.destination.name,
              city: flight.destination.city,
              timezone: flight.destination.timezone,
              _rawCoordCode: isCoord ? rawCode : undefined,
            } as AirportInfo & { _rawCoordCode?: string };
          })()
        : undefined,
      scheduledOut: flight.scheduled_out,
      estimatedOut: flight.estimated_out,
      actualOut: flight.actual_out,
      scheduledOn: flight.scheduled_on,
      estimatedOn: flight.estimated_on,
      actualOn: flight.actual_on,
      scheduledIn: flight.scheduled_in,
      estimatedIn: flight.estimated_in,
      actualIn: flight.actual_in,
      status: flight.status,
      gate: flight.gate_destination,
      terminal: flight.terminal_destination,
      routeDistance: flight.route_distance,
      route: flight.route,
      diverted: flight.diverted,
      cancelled: flight.cancelled,
      departureDelay: flight.departure_delay,
      arrivalDelay: flight.arrival_delay,
    };

    // Resolve any coordinate-based origin/destination to human-readable city names
    await resolveCoordinateEndpoints(flightData);

    logger.info('AeroAPI flight data retrieved', {
      callsign,
      origin: flightData.origin?.code,
      destination: flightData.destination?.code,
      status: flightData.status,
    });

    return flightData;
  } catch (error) {
    logger.error('AeroAPI fetch error', {
      callsign,
      error: safeErrorForLogging(error),
    });
    return null;
  }
}

/**
 * For flight endpoints that were coordinate waypoints (ARINC-424, lat/lon), resolve
 * them to a human-readable city + country string via reverse geocoding.
 * Mutates the flightData object in place.
 */
async function resolveCoordinateEndpoints(flightData: FlightData): Promise<void> {
  const endpoints = [flightData.origin, flightData.destination] as Array<
    (AirportInfo & { _rawCoordCode?: string }) | undefined
  >;

  await Promise.all(
    endpoints.map(async (endpoint) => {
      if (!endpoint?._rawCoordCode) return;
      const coords = parseCoordinateCode(endpoint._rawCoordCode);
      if (!coords) return;

      const placeName = await reverseGeocode(coords.lat, coords.lon);
      if (placeName) {
        endpoint.city = placeName;
        endpoint.name = placeName;
      }
      // Clean up the internal marker
      delete endpoint._rawCoordCode;
    }),
  );
}

/**
 * Detect whether a string looks like a geographic coordinate or waypoint rather
 * than a real airport code. AeroAPI sometimes returns ARINC-424 lat/lon fixes,
 * FAA coordinate waypoints, or raw lat/lon strings as the `code` field for
 * non-airport destinations (common in military flight plans).
 *
 * Patterns matched:
 *  - ARINC-424: "3000N07000W", "N4719W11231"
 *  - Decimal: "52.1234,13.5678", "52.1234/13.5678", "52.1234 13.5678"
 *  - Signed decimal: "-52.1234,13.5678"
 *  - FAA fix: "4730N/01230E"
 */
function looksLikeCoordinate(code: string): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  // ARINC-424 fixed-width waypoint, e.g. "3000N07000W" or "N4719W11231"
  if (/^\d{4}[NS]\d{5}[EW]$/.test(c)) return true;
  if (/^[NS]\d{4,6}[EW]\d{4,6}$/.test(c)) return true;
  // FAA-style "4730N/01230E"
  if (/^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(c)) return true;
  // Decimal lat,lon or lat/lon
  if (/^-?\d{1,3}\.\d+[,\/ ]\s*-?\d{1,3}\.\d+$/.test(c)) return true;
  return false;
}

/**
 * Parse a coordinate-like code string to { lat, lon } decimal degrees.
 * Returns null if the string cannot be parsed.
 */
function parseCoordinateCode(code: string): { lat: number; lon: number } | null {
  const c = code.trim().toUpperCase();

  // ARINC-424: "3000N07000W" => DDMM[NS]DDDMM[EW]
  const arinc = c.match(/^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/);
  if (arinc) {
    const latDeg = parseInt(arinc[1], 10) + parseInt(arinc[2], 10) / 60;
    const lonDeg = parseInt(arinc[4], 10) + parseInt(arinc[5], 10) / 60;
    return {
      lat: arinc[3] === 'S' ? -latDeg : latDeg,
      lon: arinc[6] === 'W' ? -lonDeg : lonDeg,
    };
  }

  // "N4719W11231" => [NS]DDMM[EW]DDDMM
  const nsew = c.match(/^([NS])(\d{2})(\d{2})([EW])(\d{3})(\d{2})$/);
  if (nsew) {
    const latDeg = parseInt(nsew[2], 10) + parseInt(nsew[3], 10) / 60;
    const lonDeg = parseInt(nsew[5], 10) + parseInt(nsew[6], 10) / 60;
    return {
      lat: nsew[1] === 'S' ? -latDeg : latDeg,
      lon: nsew[4] === 'W' ? -lonDeg : lonDeg,
    };
  }

  // FAA-style "4730N/01230E"
  const faa = c.match(/^(\d{2,4})([NS])\/(\d{3,5})([EW])$/);
  if (faa) {
    const rawLat = faa[1].padStart(4, '0');
    const rawLon = faa[3].padStart(5, '0');
    const latDeg = parseInt(rawLat.slice(0, 2), 10) + parseInt(rawLat.slice(2), 10) / 60;
    const lonDeg = parseInt(rawLon.slice(0, 3), 10) + parseInt(rawLon.slice(3), 10) / 60;
    return {
      lat: faa[2] === 'S' ? -latDeg : latDeg,
      lon: faa[4] === 'W' ? -lonDeg : lonDeg,
    };
  }

  // Decimal: "52.1234,13.5678" or "52.1234/13.5678"
  const decimal = c.match(/^(-?\d{1,3}\.\d+)[,\/ ]\s*(-?\d{1,3}\.\d+)$/);
  if (decimal) {
    return {
      lat: parseFloat(decimal[1]),
      lon: parseFloat(decimal[2]),
    };
  }

  return null;
}

/**
 * Format ETA for display (prefer estimated, fallback to scheduled)
 */
export function formatETA(flightData: FlightData): string | null {
  const eta = flightData.estimatedIn || flightData.scheduledIn;
  if (!eta) return null;

  try {
    const date = new Date(eta);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} UTC`;
  } catch {
    return null;
  }
}

/**
 * Format origin/destination for display
 */
export function formatRoute(flightData: FlightData): string | null {
  if (!flightData.origin && !flightData.destination) return null;

  const originCode = flightData.origin?.codeIata || flightData.origin?.code;
  const destCode =
    flightData.destination?.codeIata || flightData.destination?.code;

  if (!originCode && !destCode) return null;

  return `${originCode || '???'}→${destCode || '???'}`;
}

/**
 * Format full route with city names
 */
export function formatRouteWithCities(flightData: FlightData): string | null {
  if (!flightData.origin && !flightData.destination) return null;

  const originCity = flightData.origin?.city || flightData.origin?.code;
  const destCity = flightData.destination?.city || flightData.destination?.code;

  if (!originCity && !destCity) return null;

  return `${originCity || 'Unknown'}→${destCity || 'Unknown'}`;
}
