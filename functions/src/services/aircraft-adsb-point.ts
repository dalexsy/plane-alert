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

/** Prefer a non-empty list — some feeds expose both `ac: []` and `aircraft: [...]`. */
function aircraftFromPayload(payload: unknown): AdsBPlane[] {
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as { ac?: AdsBPlane[]; aircraft?: AdsBPlane[] };
  const ac = Array.isArray(row.ac) ? row.ac : [];
  const aircraft = Array.isArray(row.aircraft) ? row.aircraft : [];
  if (ac.length && aircraft.length) {
    return ac.length >= aircraft.length ? ac : aircraft;
  }
  return ac.length ? ac : aircraft;
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
  // adsb.fi first: airplanes.live often 403; adsb.lol has returned empty 200s.
  return [
    {
      name: 'adsb.fi',
      url: `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}`,
    },
    {
      name: 'adsb.lol',
      url: `https://api.adsb.lol/v2/point/${lat}/${lon}/${nm}`,
    },
    {
      name: 'airplanes.live',
      url: `https://api.airplanes.live/v2/point/${lat}/${lon}/${nm}`,
    },
  ];
}

async function fetchOneSource(
  src: { name: string; url: string },
): Promise<AdsBPlane[] | null> {
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
      return null;
    }
    const ac = aircraftFromPayload(await response.json());
    if (ac.length) return ac;
    logger.warn('ADS-B source empty', { baseUrl: src.name });
    return null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('ADS-B API request failed', {
      baseUrl: src.name,
      error: message,
    });
    return null;
  }
}

/**
 * First upstream (by priority) that returns a non-empty aircraft list.
 * Sources are queried in parallel so a slow empty feed cannot starve OpenSky.
 * Empty HTTP 200 is a miss.
 */
export async function fetchAdsbPointNonEmpty(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const radiusNm = radiusKm / 1.852;
  const sources = pointSources(lat, lon, radiusNm);
  const settled = await Promise.all(sources.map((src) => fetchOneSource(src)));
  for (let i = 0; i < settled.length; i++) {
    const ac = settled[i];
    if (ac?.length) {
      logger.info('ADS-B source hit', {
        baseUrl: sources[i].name,
        count: ac.length,
      });
      return ac;
    }
  }
  return null;
}
