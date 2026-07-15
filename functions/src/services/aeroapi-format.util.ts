import type { FlightData } from './aeroapi.types';
import { looksLikeCoordinate } from './aeroapi-coordinates.util';

function airportLabel(endpoint?: {
  city?: string;
  name?: string;
  codeIata?: string;
  code?: string;
}): string | null {
  if (!endpoint) return null;
  const candidates = [
    endpoint.city,
    endpoint.name,
    endpoint.codeIata,
    endpoint.code,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    if (looksLikeCoordinate(value)) continue;
    return value;
  }
  return null;
}

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

export function formatRoute(flightData: FlightData): string | null {
  if (!flightData.origin && !flightData.destination) return null;

  const originCode = airportLabel(flightData.origin);
  const destCode = airportLabel(flightData.destination);

  if (!originCode && !destCode) return null;

  return `${originCode || '???'}→${destCode || '???'}`;
}

/** Prefer city/name over ICAO — never emit lat/lon-style codes. */
export function formatRouteWithCities(flightData: FlightData): string | null {
  if (!flightData.origin && !flightData.destination) return null;

  const originCity = airportLabel(flightData.origin);
  const destCity = airportLabel(flightData.destination);

  if (!originCity && !destCity) return null;

  return `${originCity || 'Unknown'}→${destCity || 'Unknown'}`;
}