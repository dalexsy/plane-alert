/**
 * FlightAware AeroAPI Client
 * Fetches flight origin/destination/ETA data for aircraft callsigns
 */

import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';

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
        ? {
            code: flight.origin.code_icao || flight.origin.code || '',
            codeIcao: flight.origin.code_icao,
            codeIata: flight.origin.code_iata,
            name: flight.origin.name,
            city: flight.origin.city,
            timezone: flight.origin.timezone,
          }
        : undefined,
      destination: flight.destination
        ? {
            code: flight.destination.code_icao || flight.destination.code || '',
            codeIcao: flight.destination.code_icao,
            codeIata: flight.destination.code_iata,
            name: flight.destination.name,
            city: flight.destination.city,
            timezone: flight.destination.timezone,
          }
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
