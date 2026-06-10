import type { FlightData } from './aeroapi.types';

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

  const originCode = flightData.origin?.codeIata || flightData.origin?.code;
  const destCode =
    flightData.destination?.codeIata || flightData.destination?.code;

  if (!originCode && !destCode) return null;

  return `${originCode || '???'}→${destCode || '???'}`;
}

export function formatRouteWithCities(flightData: FlightData): string | null {
  if (!flightData.origin && !flightData.destination) return null;

  const originCity = flightData.origin?.city || flightData.origin?.code;
  const destCity = flightData.destination?.city || flightData.destination?.code;

  if (!originCity && !destCity) return null;

  return `${originCity || 'Unknown'}→${destCity || 'Unknown'}`;
}