import type { AdsBPlane } from '@plane-alert/shared';
import type { Location } from '../types';

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

/** Dedupe by hex; prefer a copy that still has a position. */
export function mergeAircraftPreferPosition(planes: AdsBPlane[]): AdsBPlane[] {
  const byHex = new Map<string, AdsBPlane>();
  for (const plane of planes) {
    const hex = plane.hex?.toUpperCase();
    if (!hex) continue;
    const prev = byHex.get(hex);
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
