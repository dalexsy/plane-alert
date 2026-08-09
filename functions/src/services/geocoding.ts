import { logger } from '../pi-logger';
import fetch from 'node-fetch';
import { ORIGIN_HEADER } from '../constants';

export type ReverseGeocodeResult = {
  address: string | null;
  details: Record<string, string> | null;
};

function looksLikeDecimalCoords(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^-?\d{1,3}\.\d+[,/\s]\s*-?\d{1,3}\.\d+$/.test(value.trim());
}

async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
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
    const display = data.display_name ?? null;
    return {
      address: looksLikeDecimalCoords(display) ? null : display,
      details: null,
    };
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

  if (looksLikeDecimalCoords(formatted)) {
    formatted = null;
  }

  return { address: formatted, details: address };
}

/** BigDataCloud free client reverse geocode when Nominatim is down/rate-limited. */
async function reverseGeocodeBigDataCloud(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const response = await fetch(url, { timeout: 5000 } as any);
  if (!response.ok) {
    return { address: null, details: null };
  }
  const data = (await response.json()) as {
    locality?: string;
    city?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  const primary = data.locality || data.city;
  const secondary = data.principalSubdivision || data.countryName;
  let formatted: string | null = null;
  if (primary && secondary && primary !== secondary) {
    formatted = `${primary}, ${secondary}`;
  } else {
    formatted = primary || secondary || null;
  }
  if (looksLikeDecimalCoords(formatted)) {
    formatted = null;
  }
  return { address: formatted, details: null };
}

/**
 * Reverse geocode coordinates via Nominatim (then BigDataCloud) from the Pi.
 * Never returns raw lat/lon strings.
 */
export async function reverseGeocodeDetailed(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  try {
    const primary = await reverseGeocodeNominatim(lat, lon);
    if (primary.address) {
      return primary;
    }
    return await reverseGeocodeBigDataCloud(lat, lon);
  } catch (error) {
    logger.warn('Reverse geocoding failed', { lat, lon, error });
    try {
      return await reverseGeocodeBigDataCloud(lat, lon);
    } catch {
      return { address: null, details: null };
    }
  }
}

/** Used by notifications and Pi HTTP handler. Place names only. */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  const result = await reverseGeocodeDetailed(lat, lon);
  return result.address;
}
