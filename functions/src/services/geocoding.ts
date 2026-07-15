import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { ORIGIN_HEADER } from '../constants';

export type ReverseGeocodeResult = {
  address: string | null;
  details: Record<string, string> | null;
};

/**
 * Reverse geocode coordinates via Nominatim from the Pi (not the browser).
 */
export async function reverseGeocodeDetailed(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': ORIGIN_HEADER,
      },
    });

    if (!response.ok) {
      return { address: null, details: null };
    }

    const data = (await response.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };

    const address = data.address;
    if (!address) {
      return { address: data.display_name ?? null, details: null };
    }

    const primaryLocation =
      address.neighbourhood ||
      address.suburb ||
      address.village ||
      address.town ||
      address.city;

    const country = address.country;
    let secondLevel: string | null = null;

    if (country && country !== 'Germany' && country !== 'Deutschland') {
      secondLevel = country;
    } else {
      secondLevel = address.county || address.state_district || null;
    }

    let formatted: string | null = null;
    if (primaryLocation && secondLevel) {
      formatted = `${primaryLocation}, ${secondLevel}`;
    } else {
      formatted = primaryLocation || secondLevel || data.display_name || null;
    }

    return { address: formatted, details: address };
  } catch (error) {
    logger.warn('Reverse geocoding failed', { lat, lon, error });
    return { address: null, details: null };
  }
}

/** Used by notifications and Pi HTTP handler. */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  const result = await reverseGeocodeDetailed(lat, lon);
  return result.address;
}
