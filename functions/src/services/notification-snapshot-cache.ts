import { JsonDocumentStore } from '../json-document-store';
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
  /** Union of household homes — do not refetch from one location. */
  skipRadiusFilter?: boolean;
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
  // DocumentTimestamp JSON round-trip → { millis: n } (no toMillis).
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { millis?: number }).millis === 'number' &&
    Number.isFinite((value as { millis: number }).millis)
  ) {
    return (value as { millis: number }).millis;
  }
  // legacy Timestamp JSON shape (patch miss / legacy writes).
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { _seconds?: number })._seconds === 'number'
  ) {
    const seconds = (value as { _seconds: number })._seconds;
    const nanos = (value as { _nanoseconds?: number })._nanoseconds ?? 0;
    return seconds * 1000 + Math.floor(nanos / 1e6);
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: number }).seconds === 'number'
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  // Broken serverTimestamp Sentinel → `{}` — treat as missing (force refetch).
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
  db: JsonDocumentStore,
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
