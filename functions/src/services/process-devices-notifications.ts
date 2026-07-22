import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from '../types';
import { notifyForDevice } from './notify-for-device';
import { chimeKioskForMilitaryInRange } from './kiosk-military-in-range-chime';
import {
  getDeviceLocation,
  loadAircraftSnapshotCache,
  locationCacheKey,
  uniqueLocationKeysFromDevices,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';

type DeviceDoc = {
  ref: admin.firestore.DocumentReference;
  id: string;
  data: DeviceRegistration;
};

export async function processDevicesWithSnapshotCache(
  db: admin.firestore.Firestore,
  docs: DeviceDoc[],
  getRegisteredPushoverDevices?: (
    userKey: string,
  ) => Promise<Set<string> | null | undefined>,
  /** Homes to scan for kiosk chime (defaults to docs). Use all active devices. */
  chimeDocs?: DeviceDoc[],
): Promise<void> {
  const chimeSource = chimeDocs ?? docs;
  const locationKeys = uniqueLocationKeysFromDevices(
    [...chimeSource, ...docs].map((entry) => ({ data: entry.data })),
  );
  const aircraftCache = await loadAircraftSnapshotCache(db, locationKeys);

  logger.info('Loaded aircraft snapshots for notification processing', {
    uniqueLocations: locationKeys.length,
    cachedLocations: aircraftCache.size,
  });

  // Chime before Pushover notify — same boring gate as Pushover; device match
  // failures must not silence interesting mil on the house speaker.
  await chimeKioskForMilitaryInRange(chimeSource, aircraftCache);

  const docsByUserKey = new Map<string, DeviceDoc[]>();
  for (const entry of docs) {
    const userKey = entry.data?.pushoverUserKey?.trim();
    if (!userKey) {
      continue;
    }
    const group = docsByUserKey.get(userKey) ?? [];
    group.push(entry);
    docsByUserKey.set(userKey, group);
  }

  const tasks = [...docsByUserKey.entries()].map(async ([userKey, entries]) => {
    const registeredPushoverDevices = getRegisteredPushoverDevices
      ? await getRegisteredPushoverDevices(userKey)
      : undefined;

    if (entries.length > 1) {
      logger.warn('Multiple device registrations for one Pushover user', {
        userKey: userKey.slice(0, 8),
        registrationCount: entries.length,
      });
    }

    for (const entry of entries) {
      const deviceLocation = getDeviceLocation(entry.data);

      let cachedSnapshot: CachedAircraftSnapshot | undefined;
      if (deviceLocation) {
        cachedSnapshot = aircraftCache.get(
          locationCacheKey(
            deviceLocation.lat,
            deviceLocation.lon,
            entry.data.radiusKm,
          ),
        );
      }

      await notifyForDevice(
        db,
        entry.ref,
        entry.data,
        entry.id,
        registeredPushoverDevices,
        cachedSnapshot,
      ).catch((error) =>
        logger.error('notifyForDevice failed', {
          docId: entry.id,
          deviceName: entry.data.deviceName,
          userKey: entry.data.pushoverUserKey?.slice(0, 8),
          error,
        }),
      );
    }
  });

  await Promise.all(tasks);
}
