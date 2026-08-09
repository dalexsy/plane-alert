import { logger } from '../pi-logger';
import fetch from 'node-fetch';
import { haversineDistanceKm, type AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';
import { ORIGIN_HEADER } from '../constants';
import {
  destinationPoint,
  mergeAircraftPreferPosition,
} from './aircraft-geo-merge.util';
import { fetchAircraftForCollection } from './aircraft-collection-fetch';

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

/**
 * Global mil feed filtered to radius — point `/v2/point` near dense hubs
 * drops in-range military. Merge every upstream (do not return on the first
 * empty inRange — one feed often omits lat/lon while another still has it).
 */
export async function fetchMilitaryAircraftInRadius(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  const merged: AdsBPlane[] = [];
  let anyOk = false;

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

      anyOk = true;
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
      merged.push(...inRange);
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

  if (!anyOk) {
    logger.warn('All ADS-B mil sources failed', { location, radiusKm });
  }
  return mergeAircraftPreferPosition(merged);
}

/**
 * Offset `/v2/point` queries when the mil feed has no positioned aircraft in
 * radius — Berlin hub density drops mil at 60–90km from the home pin.
 */
export async function fetchAircraftRingAroundHome(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  const offsetKm = Math.min(Math.max(radiusKm * 0.45, 35), 55);
  const ringRadiusKm = Math.min(Math.max(radiusKm * 0.5, 40), 60);
  const bearings = [0, 60, 120, 180, 240, 300];

  const batches = await Promise.all(
    bearings.map(async (bearing) => {
      const dest = destinationPoint(
        location.lat,
        location.lon,
        bearing,
        offsetKm,
      );
      const ac = await fetchAircraftForCollection(dest, ringRadiusKm);
      return ac ?? [];
    }),
  );

  const merged = mergeAircraftPreferPosition(batches.flat());
  const inHomeRadius = merged.filter((plane) => {
    if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
      return false;
    }
    return (
      haversineDistanceKm(location.lat, location.lon, plane.lat, plane.lon) <=
      radiusKm
    );
  });

  logger.info('Ring point fill for kiosk chime', {
    offsetKm,
    ringRadiusKm,
    raw: merged.length,
    inHomeRadius: inHomeRadius.length,
  });
  return inHomeRadius;
}
