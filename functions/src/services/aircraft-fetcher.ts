import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import type { AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';
import { ORIGIN_HEADER } from '../constants';

/**
 * Fetch aircraft within a radius from ADS-B One API
 */
export async function fetchAircraft(
  location: Location,
  radiusKm: number
): Promise<AdsBPlane[]> {
  const radiusNm = radiusKm / 1.852;
  const url = `https://api.adsb.one/v2/point/${location.lat}/${
    location.lon
  }/${radiusNm.toFixed(2)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': ORIGIN_HEADER,
      Accept: 'application/json',
    },
    timeout: 5000,
  } as any);

  if (!response.ok) {
    logger.warn('ADS-B API error', response.status, response.statusText);
    return [];
  }

  const payload = (await response.json()) as { ac?: AdsBPlane[] };
  return payload.ac ?? [];
}
