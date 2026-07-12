import { logger } from 'firebase-functions/v2';
import type { AdsBPlane } from '@plane-alert/shared';
import { fetchAircraftForCollection } from './aircraft-collection-fetch';
import {
  isSnapshotStale,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import type { Location } from '../types';

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
