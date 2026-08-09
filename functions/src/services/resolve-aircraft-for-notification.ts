import { logger } from '../pi-logger';
import type { AdsBPlane } from '@plane-alert/shared';
import { fetchAircraftForCollection } from './aircraft-collection-fetch';
import {
  isSnapshotStale,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import type { Location } from '../types';

function mergeAircraftByHex(
  primary: AdsBPlane[],
  extra: AdsBPlane[],
): AdsBPlane[] {
  const byHex = new Map<string, AdsBPlane>();
  for (const plane of primary) {
    const hex = plane.hex?.toUpperCase();
    if (hex) byHex.set(hex, plane);
  }
  for (const plane of extra) {
    const hex = plane.hex?.toUpperCase();
    if (hex && !byHex.has(hex)) byHex.set(hex, plane);
  }
  return [...byHex.values()];
}

export async function resolveAircraftForNotification(
  deviceLocation: Location,
  radiusKm: number,
  cachedSnapshot: CachedAircraftSnapshot | undefined,
  docId: string,
): Promise<AdsBPlane[]> {
  const useCache =
    cachedSnapshot &&
    cachedSnapshot.aircraft.length > 0 &&
    !isSnapshotStale(cachedSnapshot.snapshotAgeMs);

  if (useCache) {
    return cachedSnapshot.aircraft;
  }

  const fresh = await fetchAircraftForCollection(deviceLocation, radiusKm);
  if (fresh !== null && fresh.length > 0) {
    // Broken timestamp (`{}`) forces refetch; point near Berlin may drop mil that
    // the cache still holds — merge so kiosk/Pushover do not go quiet.
    if (
      cachedSnapshot?.aircraft.length &&
      cachedSnapshot.snapshotAgeMs === null
    ) {
      const merged = mergeAircraftByHex(cachedSnapshot.aircraft, fresh);
      logger.info('Merged cache with refetch after broken snapshot timestamp', {
        docId,
        cacheCount: cachedSnapshot.aircraft.length,
        freshCount: fresh.length,
        mergedCount: merged.length,
      });
      return merged;
    }
    logger.info('Refetched aircraft for notifications', {
      docId,
      aircraftCount: fresh.length,
      hadStaleCache: Boolean(cachedSnapshot?.aircraft.length),
      snapshotAgeMs: cachedSnapshot?.snapshotAgeMs,
    });
    return fresh;
  }

  if (cachedSnapshot?.aircraft.length) {
    logger.warn('ADS-B fetch failed; using cached aircraft snapshot', {
      docId,
      aircraftCount: cachedSnapshot.aircraft.length,
      snapshotAgeMs: cachedSnapshot.snapshotAgeMs,
    });
    return cachedSnapshot.aircraft;
  }

  return fresh ?? [];
}
