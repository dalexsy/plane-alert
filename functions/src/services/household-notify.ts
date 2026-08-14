import { haversineDistanceKm } from '@plane-alert/shared';
import type { AdsBPlane } from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { clampRadius } from '../utils';
import type { JsonDocumentReference } from './json-document-store-refs';
import {
  getDeviceLocation,
  locationCacheKey,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';

export type HouseholdDeviceDoc = {
  ref: JsonDocumentReference;
  id: string;
  data: DeviceRegistration;
};

/** One registration per account — never loop notifyForDevice per phone. */
export function pickHouseholdPrimary(
  entries: HouseholdDeviceDoc[],
): HouseholdDeviceDoc {
  const withLoc = entries.filter((entry) => getDeviceLocation(entry.data));
  const pool = withLoc.length ? withLoc : entries;
  return pool.reduce((best, cur) => {
    if (cur.data.notifyProximity && !best.data.notifyProximity) {
      return cur;
    }
    if (!cur.data.notifyProximity && best.data.notifyProximity) {
      return best;
    }
    return cur.id.localeCompare(best.id) < 0 ? cur : best;
  });
}

function planeHex(plane: AdsBPlane): string {
  return (plane.hex ?? '').trim().toUpperCase();
}

function planeInRange(
  plane: AdsBPlane,
  lat: number,
  lon: number,
  radiusKm: number,
): boolean {
  if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
    return false;
  }
  return haversineDistanceKm(lat, lon, plane.lat, plane.lon) <= radiusKm;
}

/** Planes in range of any household home, one row per ICAO. */
export function mergeHouseholdInRangeAircraft(
  entries: HouseholdDeviceDoc[],
  cache: Map<string, CachedAircraftSnapshot>,
): CachedAircraftSnapshot {
  const byHex = new Map<string, AdsBPlane>();
  let newestAge: number | null = null;

  for (const entry of entries) {
    const loc = getDeviceLocation(entry.data);
    if (!loc) {
      continue;
    }
    const radiusKm = clampRadius(entry.data.radiusKm);
    const snap = cache.get(
      locationCacheKey(loc.lat, loc.lon, entry.data.radiusKm),
    );
    if (!snap) {
      continue;
    }
    if (snap.snapshotAgeMs != null) {
      newestAge =
        newestAge == null
          ? snap.snapshotAgeMs
          : Math.min(newestAge, snap.snapshotAgeMs);
    }
    for (const plane of snap.aircraft) {
      const hex = planeHex(plane);
      if (!hex || byHex.has(hex)) {
        continue;
      }
      if (planeInRange(plane, loc.lat, loc.lon, radiusKm)) {
        byHex.set(hex, plane);
      }
    }
  }

  return {
    aircraft: [...byHex.values()],
    snapshotAgeMs: newestAge,
    skipRadiusFilter: true,
  };
}
