import * as admin from 'firebase-admin';
import type { AdsBPlane } from '@plane-alert/shared';
import {
  AIRCRAFT_SNAPSHOTS_COLLECTION,
  AIRCRAFT_SNAPSHOT_MAX_AGE_MS,
} from '../constants';
import { clampRadius } from '../utils';
import type { DeviceRegistration, Location } from '../types';

export interface CachedAircraftSnapshot {
  aircraft: AdsBPlane[];
  snapshotAgeMs: number | null;
}

function getTimestampMillis(value: unknown): number | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toMillis?: () => number }).toMillis === 'function'
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return typeof millis === 'number' && !Number.isNaN(millis) ? millis : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: number }).seconds === 'number'
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

export function isSnapshotStale(snapshotAgeMs: number | null): boolean {
  if (snapshotAgeMs === null) {
    return true;
  }
  return snapshotAgeMs > AIRCRAFT_SNAPSHOT_MAX_AGE_MS;
}

export function getDeviceLocation(
  data: DeviceRegistration,
): Location | undefined {
  return data.location || (data as { home?: Location }).home;
}

export function locationCacheKey(
  lat: number,
  lon: number,
  radiusKm?: number,
): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `${roundedLat}_${roundedLon}_${clampRadius(radiusKm)}`;
}

export function uniqueLocationKeysFromDevices(
  devices: Array<{ data: DeviceRegistration }>,
): string[] {
  return [
    ...new Set(
      devices
        .map(({ data }) => {
          const loc = getDeviceLocation(data);
          if (!loc) return null;
          return locationCacheKey(loc.lat, loc.lon, data.radiusKm);
        })
        .filter((key): key is string => key !== null),
    ),
  ];
}

export async function loadAircraftSnapshotCache(
  db: admin.firestore.Firestore,
  locationKeys: string[],
): Promise<Map<string, CachedAircraftSnapshot>> {
  const cache = new Map<string, CachedAircraftSnapshot>();
  await Promise.all(
    locationKeys.map(async (key) => {
      const snapDoc = await db
        .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
        .doc(key)
        .get();
      if (snapDoc.exists) {
        const snapData = snapDoc.data() as {
          aircraft?: AdsBPlane[];
          timestamp?: unknown;
        };
        if (Array.isArray(snapData?.aircraft)) {
          const timestampMs = getTimestampMillis(snapData.timestamp);
          cache.set(key, {
            aircraft: snapData.aircraft,
            snapshotAgeMs:
              timestampMs !== null ? Date.now() - timestampMs : null,
          });
        }
      }
    }),
  );
  return cache;
}
