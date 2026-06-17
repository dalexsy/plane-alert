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
import { pruneOrphanDeviceRegistrations } from './services/prune-orphan-registrations';
import { dedupeDeviceRegistrationsByPushoverTarget } from './services/dedupe-device-registrations';
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

  const userKeys = [
    ...new Set(
      allDevices
        .map((entry) => entry.data.pushoverUserKey)
        .filter((key): key is string => typeof key === 'string' && key.length > 0),
    ),
  ];

  for (const userKey of userKeys) {
    const validation = await validatePushoverUserKey(userKey);
    if (validation.valid && validation.devices.length) {
      const pruned = await pruneOrphanDeviceRegistrations(
        db,
        userKey,
        validation.devices,
      );
      if (pruned > 0) {
        logger.info('Auto-pruned orphan registrations during processPlanes', {
          userKey: userKey.slice(0, 8),
          pruned,
        });
      }
    }
  }

  const activeSnapshot = await db.collection(DEVICE_COLLECTION).get();
  const activeDevices = activeSnapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    data: doc.data() as DeviceRegistration,
  }));

  await recordProcessPlanesStart(db, activeDevices.length);

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
          .map((name) => name.trim()),
      );

      pushoverDeviceCache.set(userKey, devices);
      return devices;
    };

    const registeredDevicesByUserKey = new Map<string, Set<string>>();
    for (const userKey of userKeys) {
      const devices = await getRegisteredPushoverDevices(userKey);
      if (devices?.size) {
        registeredDevicesByUserKey.set(userKey, devices);
      }
    }

    const { toProcess: dedupedDevices, duplicateRefs } =
      dedupeDeviceRegistrationsByPushoverTarget(
        activeDevices,
        registeredDevicesByUserKey,
      );

    if (duplicateRefs.length > 0) {
      await Promise.all(duplicateRefs.map((ref) => ref.delete()));
      logger.info('Pruned duplicate device registrations by Pushover target', {
        pruned: duplicateRefs.length,
      });
    }

    if (dedupedDevices.length < activeDevices.length) {
      logger.info('Deduped device registrations by Pushover target', {
        before: activeDevices.length,
        after: dedupedDevices.length,
      });
    }

    await processDevicesWithSnapshotCache(
      db,
      dedupedDevices,
      getRegisteredPushoverDevices,
    );
    await recordProcessPlanesSuccess(db);
    return;
  }

  logger.info('Broadcast mode: processing all devices', {
    deviceCount: activeDevices.length,
  });

  await processDevicesWithSnapshotCache(db, activeDevices);
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