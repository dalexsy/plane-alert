import fetch from 'node-fetch';
import type { AdsBPlane } from '@plane-alert/shared';
import { ORIGIN_HEADER } from '../constants';
import { logger } from '../pi-logger';

export async function fetchWithTimeout(
  url: string,
  init: Record<string, unknown>,
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

function aircraftFromPayload(payload: unknown): AdsBPlane[] {
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as { ac?: AdsBPlane[]; aircraft?: AdsBPlane[] };
  const list = row.ac ?? row.aircraft;
  return Array.isArray(list) ? list : [];
}

function pointSources(
  lat: number,
  lon: number,
  radiusNm: number,
): { name: string; url: string }[] {
  const nm = radiusNm.toFixed(2);
  const override = process.env.ADSB_POINT_API_BASE_URL?.trim();
  if (override) {
    const base = override.replace(/\/$/, '');
    return [{ name: base, url: `${base}/v2/point/${lat}/${lon}/${nm}` }];
  }
  return [
    {
      name: 'airplanes.live',
      url: `https://api.airplanes.live/v2/point/${lat}/${lon}/${nm}`,
    },
    {
      name: 'adsb.lol',
      url: `https://api.adsb.lol/v2/point/${lat}/${lon}/${nm}`,
    },
    {
      name: 'adsb.fi',
      url: `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}`,
    },
  ];
}

/** First upstream that returns a non-empty aircraft list. Empty 200 is a miss. */
export async function fetchAdsbPointNonEmpty(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const radiusNm = radiusKm / 1.852;
  for (const src of pointSources(lat, lon, radiusNm)) {
    try {
      const response = await fetchWithTimeout(
        src.url,
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
          baseUrl: src.name,
          status: response.status,
          statusText: response.statusText,
        });
        continue;
      }
      const ac = aircraftFromPayload(await response.json());
      if (ac.length) return ac;
      logger.warn('ADS-B source empty', { baseUrl: src.name });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('ADS-B API request failed', {
        baseUrl: src.name,
        error: message,
      });
    }
  }
  return null;
}
