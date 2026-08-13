import { logger } from '../pi-logger';
import type { AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';
import { ORIGIN_HEADER } from '../constants';
import {
  fetchAdsbPointNonEmpty,
  fetchWithTimeout,
} from './aircraft-adsb-point';

async function fetchFromOpenSky(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos((location.lat * Math.PI) / 180);
  const lonDelta = radiusKm / (111.32 * Math.max(cosLat, 0.01));

  const lamin = location.lat - latDelta;
  const lamax = location.lat + latDelta;
  const lomin = location.lon - lonDelta;
  const lomax = location.lon + lonDelta;

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

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
      logger.warn('OpenSky API error', response.status, response.statusText);
      return null;
    }

    const payload = (await response.json()) as any;
    const states: any[] = Array.isArray(payload?.states) ? payload.states : [];

    const knotsPerMs = 1.94384;
    const feetPerMeter = 3.28084;

    return states
      .map((s: any[]): AdsBPlane | null => {
        const icao24 = typeof s?.[0] === 'string' ? s[0] : null;
        const callsignRaw = typeof s?.[1] === 'string' ? s[1] : '';
        const lon = typeof s?.[5] === 'number' ? s[5] : null;
        const lat = typeof s?.[6] === 'number' ? s[6] : null;
        if (!icao24 || lat === null || lon === null) return null;

        const baroAltM = typeof s?.[7] === 'number' ? s[7] : null;
        const onGround = s?.[8] === true;
        const velocityMs = typeof s?.[9] === 'number' ? s[9] : null;
        const trueTrack = typeof s?.[10] === 'number' ? s[10] : null;
        const verticalRateMs = typeof s?.[11] === 'number' ? s[11] : null;
        const geoAltM = typeof s?.[13] === 'number' ? s[13] : null;
        const squawk = typeof s?.[14] === 'string' ? s[14] : undefined;

        return {
          hex: icao24.toUpperCase(),
          flight: callsignRaw.trim() || undefined,
          callsign: callsignRaw.trim() || undefined,
          lat,
          lon,
          gs: velocityMs !== null ? velocityMs * knotsPerMs : undefined,
          track: trueTrack !== null ? trueTrack : undefined,
          alt_baro:
            baroAltM !== null ? Math.round(baroAltM * feetPerMeter) : undefined,
          alt_geom:
            geoAltM !== null ? Math.round(geoAltM * feetPerMeter) : undefined,
          baro_rate:
            verticalRateMs !== null
              ? Math.round(verticalRateMs * feetPerMeter * 60)
              : undefined,
          gnd: onGround,
          squawk,
        };
      })
      .filter((p: AdsBPlane | null): p is AdsBPlane => p !== null);
  } catch (error: any) {
    logger.error('Failed to fetch from OpenSky', {
      error: error?.message,
      location,
      radiusKm,
    });
    return null;
  }
}

/**
 * Fetch aircraft within a radius from ADS-B One API
 */
export async function fetchAircraft(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  const ac = await fetchAdsbPointNonEmpty(location.lat, location.lon, radiusKm);
  if (ac?.length) return ac;
  const fallback = await fetchFromOpenSky(location, radiusKm);
  return fallback ?? [];
}
