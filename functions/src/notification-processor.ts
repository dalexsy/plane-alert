import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from './types';
import { DEVICE_COLLECTION } from './constants';
import {
  validatePushoverUserKey,
  shouldBroadcastToAllDevices,
} from './utils';
import { notifyForDevice } from './services/notify-for-device';
import {
  getDeviceLocation,
  loadAircraftSnapshotCache,
  locationCacheKey,
  uniqueLocationKeysFromDevices,
  type CachedAircraftSnapshot,
} from './services/notification-snapshot-cache';
import {
  recordProcessPlanesFailure,
  recordProcessPlanesStart,
  recordProcessPlanesSuccess,
} from './services/notification-health';

async function processDevicesWithSnapshotCache(
  db: admin.firestore.Firestore,
  docs: Array<{
    ref: admin.firestore.DocumentReference;
    id: string;
    data: DeviceRegistration;
  }>,
  getRegisteredPushoverDevices?: (
    userKey: string,
  ) => Promise<Set<string> | null | undefined>,
): Promise<void> {
  const locationKeys = uniqueLocationKeysFromDevices(
    docs.map((entry) => ({ data: entry.data })),
  );
  const aircraftCache = await loadAircraftSnapshotCache(db, locationKeys);

  logger.info('Loaded aircraft snapshots for notification processing', {
    uniqueLocations: locationKeys.length,
    cachedLocations: aircraftCache.size,
  });

  const tasks = docs.map(async (entry) => {
    const deviceLocation = getDeviceLocation(entry.data);
    const userKey = entry.data?.pushoverUserKey;
    const registeredPushoverDevices = getRegisteredPushoverDevices && userKey
      ? await getRegisteredPushoverDevices(userKey)
      : undefined;

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

    return notifyForDevice(
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
  });

  await Promise.all(tasks);
}

export async function runNotificationProcessing(
  db: admin.firestore.Firestore,
): Promise<void> {
  const broadcastAllDevices = shouldBroadcastToAllDevices();

  const snapshot = await db.collection(DEVICE_COLLECTION).get();
  if (snapshot.empty) {
    logger.info('No registered devices.');
    await recordProcessPlanesStart(db, 0);
    await recordProcessPlanesSuccess(db);
    return;
  }

  const allDevices = snapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    data: doc.data() as DeviceRegistration,
  }));

  await recordProcessPlanesStart(db, allDevices.length);

  if (!broadcastAllDevices) {
    const pushoverDeviceCache = new Map<string, Set<string> | null>();

    const getRegisteredPushoverDevices = async (userKey: string) => {
      if (pushoverDeviceCache.has(userKey)) {
        return pushoverDeviceCache.get(userKey)!;
      }

      const validation = await validatePushoverUserKey(userKey);
      if (!validation.valid) {
        pushoverDeviceCache.set(userKey, null);
        return null;
      }

      const devices = new Set(
        validation.devices
          .filter(
            (name): name is string =>
              typeof name === 'string' && name.trim().length > 0,
          )
          .map((name) => name.trim().toLowerCase()),
      );

      pushoverDeviceCache.set(userKey, devices);
      return devices;
    };

    await processDevicesWithSnapshotCache(
      db,
      allDevices,
      getRegisteredPushoverDevices,
    );
    await recordProcessPlanesSuccess(db);
    return;
  }

  logger.info('Broadcast mode: processing all devices', {
    deviceCount: allDevices.length,
  });

  await processDevicesWithSnapshotCache(db, allDevices);
  await recordProcessPlanesSuccess(db);
}

export function createNotificationProcessorFunction(
  db: admin.firestore.Firestore,
) {
  return onSchedule(
    {
      schedule: '*/2 * * * *', // Every 2 minutes
      timeZone: 'Etc/UTC',
      maxInstances: 1,
      region: 'europe-west3',
    },
    async () => {
      try {
        await runNotificationProcessing(db);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        await recordProcessPlanesFailure(db, message);
        throw error;
      }
    },
  );
}