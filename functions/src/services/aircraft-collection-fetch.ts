import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import { haversineDistanceKm, type AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';
import { ORIGIN_HEADER } from '../constants';

async function fetchWithTimeout(
  url: string,
  init: any,
  timeoutMs: number,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal } as any);
  } finally {
    clearTimeout(timer);
  }
}

function adsbPointBaseUrls(): string[] {
  return (
    process.env.ADSB_POINT_API_BASE_URL?.trim()
      ? [process.env.ADSB_POINT_API_BASE_URL.trim()]
      : ['https://api.airplanes.live', 'https://api.adsb.lol']
  ).map((url) => url.replace(/\/$/, ''));
}

export async function fetchAircraftForCollection(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const radiusNm = radiusKm / 1.852;

  for (const baseUrl of adsbPointBaseUrls()) {
    const url = `${baseUrl}/v2/point/${location.lat}/${location.lon}/${radiusNm.toFixed(
      2,
    )}`;

    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': ORIGIN_HEADER,
            Accept: 'application/json',
          },
        },
        5000,
      );

      if (!response.ok) {
        logger.warn('ADS-B API error', {
          baseUrl,
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }

      const payload = (await response.json()) as { ac?: AdsBPlane[] };
      return payload.ac ?? [];
    } catch (error: any) {
      logger.warn('ADS-B API request failed', {
        baseUrl,
        error: error?.message,
        location,
        radiusKm,
      });
    }
  }

  // Do not fall back to OpenSky for scheduled collection: OpenSky lacks mil/dbFlags
  // and would overwrite good snapshots, breaking military push notifications.
  logger.error('All ADS-B sources failed for collection', {
    location,
    radiusKm,
  });
  return null;
}

/**
 * Global mil feed filtered to radius — point `/v2/point` near dense hubs
 * (Berlin) returns ~20–30 nearest and routinely drops in-range military that
 * phones still show when their map center differs from the home pin.
 */
export async function fetchMilitaryAircraftInRadius(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  for (const baseUrl of adsbPointBaseUrls()) {
    const url = `${baseUrl}/v2/mil`;
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': ORIGIN_HEADER,
            Accept: 'application/json',
          },
        },
        8000,
      );

      if (!response.ok) {
        logger.warn('ADS-B mil API error', {
          baseUrl,
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }

      const payload = (await response.json()) as { ac?: AdsBPlane[] };
      const all = payload.ac ?? [];
      const inRange = all.filter((plane) => {
        if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
          return false;
        }
        return (
          haversineDistanceKm(location.lat, location.lon, plane.lat, plane.lon) <=
          radiusKm
        );
      });
      logger.info('Fetched mil aircraft in radius', {
        baseUrl,
        totalMil: all.length,
        inRange: inRange.length,
        radiusKm,
      });
      return inRange;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('ADS-B mil API request failed', {
        baseUrl,
        error: message,
        location,
        radiusKm,
      });
    }
  }

  logger.warn('All ADS-B mil sources failed', { location, radiusKm });
  return [];
}
