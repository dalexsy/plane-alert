/**
 * FlightAware AeroAPI Client
 * Fetches flight origin/destination/ETA data for aircraft callsigns
 */

import { logger } from '../pi-logger';
import fetch from 'node-fetch';
import type { AeroApiResponse, FlightData } from './aeroapi.types';
import {
  normalizeAirportEndpoint,
  resolveCoordinateEndpoints,
} from './aeroapi-coordinates.util';

export type { FlightData, AirportInfo } from './aeroapi.types';
export {
  formatETA,
  formatRoute,
  formatRouteWithCities,
} from './aeroapi-format.util';

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

export async function fetchFlightData(
  callsign: string,
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

    const flight = data.flights[0];
    const flightData: FlightData = {
      ident: flight.ident || cleanCallsign,
      operator: flight.operator_icao || flight.operator,
      aircraftType: flight.aircraft_type,
      registration: flight.registration,
      origin: normalizeAirportEndpoint(flight.origin),
      destination: normalizeAirportEndpoint(flight.destination),
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