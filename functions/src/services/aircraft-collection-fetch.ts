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

function mergeByHex(planes: AdsBPlane[]): AdsBPlane[] {
  const byHex = new Map<string, AdsBPlane>();
  for (const plane of planes) {
    const hex = plane.hex?.toUpperCase();
    if (!hex) continue;
    const prev = byHex.get(hex);
    // Prefer a copy that still has a position (mil feed often omits lat/lon).
    if (
      !prev ||
      (typeof plane.lat === 'number' &&
        typeof plane.lon === 'number' &&
        (typeof prev.lat !== 'number' || typeof prev.lon !== 'number'))
    ) {
      byHex.set(hex, plane);
    }
  }
  return [...byHex.values()];
}

/** Destination at `distanceKm` along `bearingDeg` (0=N) from lat/lon. */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): Location {
  const R = 6371;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const ang = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) +
      Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
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
 *
 * Merge every upstream (do not return on the first empty inRange — airplanes.live
 * often lists nearby mil without lat/lon while adsb.lol still has positions).
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
  return mergeByHex(merged);
}

/**
 * Offset `/v2/point` queries — Berlin hub density drops mil at 60–90km from the
 * home pin. Used when the mil feed has no positioned aircraft in radius.
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

  const merged = mergeByHex(batches.flat());
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
