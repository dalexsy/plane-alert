import { logger } from '../pi-logger';
import fetch from 'node-fetch';
import type { AdsBPlane } from '@plane-alert/shared';
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

export {
  fetchMilitaryAircraftInRadius,
  fetchAircraftRingAroundHome,
} from './aircraft-mil-and-ring-fetch';
