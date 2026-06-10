import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { ORIGIN_HEADER } from '../constants';

/**
 * Reverse geocode coordinates to human-readable location
 * Optimized for German locations with international fallback
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': ORIGIN_HEADER,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;

    // Try to get neighborhood, suburb, or city with context
    const address = data.address;
    if (!address) return null;

    // Get the most specific location
    const primaryLocation =
      address.neighbourhood ||
      address.suburb ||
      address.village ||
      address.town ||
      address.city;

    // Determine second level: use country name if not Germany, otherwise use district
    const country = address.country;
    let secondLevel: string | null = null;

    if (country && country !== 'Germany' && country !== 'Deutschland') {
      // For non-German locations, show country
      secondLevel = country;
    } else {
      // For Germany, show district/county for local context
      secondLevel = address.county || address.state_district;
    }

    // Combine primary location with second level if both exist
    if (primaryLocation && secondLevel) {
      return `${primaryLocation}, ${secondLevel}`;
    }

    // Fall back to just the primary location or second level
    return primaryLocation || secondLevel || null;
  } catch (error) {
    logger.warn('Reverse geocoding failed', { lat, lon, error });
    return null;
  }
}
