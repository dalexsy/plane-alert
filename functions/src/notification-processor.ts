import { JsonDocumentStore } from './json-document-store';
import { onSchedule } from './on-request';
import { logger } from './pi-logger';
import type { DeviceRegistration } from './types';
import { DEVICE_COLLECTION } from './constants';
import {
  validatePushoverUserKey,
} from './utils';
import { pruneOrphanDeviceRegistrations } from './services/prune-orphan-registrations';
import {
  dedupeDeviceRegistrationsByPushoverTarget,
} from './services/dedupe-device-registrations';
import { processDevicesWithSnapshotCache } from './services/process-devices-notifications';
import {
  recordProcessPlanesFailure,
  recordProcessPlanesStart,
  recordProcessPlanesSuccess,
  releaseProcessPlanesLock,
  tryAcquireProcessPlanesLock,
} from './services/notification-health';
import { isPushoverSendEnabled } from './services/pushover-send-gate';

export async function runNotificationProcessing(
  db: JsonDocumentStore,
): Promise<void> {
  if (!isPushoverSendEnabled()) {
    logger.info('Skipping processPlanes — Pushover send disabled on this host');
    await recordProcessPlanesStart(db, 0);
    await recordProcessPlanesSuccess(db);
    return;
  }

  const acquired = await tryAcquireProcessPlanesLock(db);
  if (!acquired) {
    logger.info('Skipping processPlanes — another run is in progress');
    return;
  }

  try {
    await runNotificationProcessingBody(db);
  } finally {
    await releaseProcessPlanesLock(db);
  }
}

async function runNotificationProcessingBody(
  db: JsonDocumentStore,
): Promise<void> {
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
    data: doc.data() as unknown as DeviceRegistration,
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
    data: doc.data() as unknown as DeviceRegistration,
  }));

  await recordProcessPlanesStart(db, activeDevices.length);

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

    if (!devices.size) {
      pushoverDeviceCache.set(userKey, null);
      return null;
    }

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

  const dedupeResult = dedupeDeviceRegistrationsByPushoverTarget(
    activeDevices,
    registeredDevicesByUserKey,
  );

  const { toProcess: devicesToProcess, duplicateRefs } = dedupeResult;

  if (duplicateRefs.length > 0) {
    await Promise.all(duplicateRefs.map((ref) => ref.delete()));
    logger.info('Pruned duplicate device registrations', {
      pruned: duplicateRefs.length,
    });
  }

  if (devicesToProcess.length < activeDevices.length) {
    logger.info('Deduped device registrations before notify', {
      before: activeDevices.length,
      after: devicesToProcess.length,
    });
  }

  if (activeDevices.length > 0 && devicesToProcess.length === 0) {
    logger.warn('No device registrations resolved for notification delivery', {
      registeredCount: activeDevices.length,
    });
  }

  await processDevicesWithSnapshotCache(
    db,
    devicesToProcess,
    getRegisteredPushoverDevices,
    // Chime every home even when Pushover target list is empty / unmatched.
    activeDevices,
  );
  await recordProcessPlanesSuccess(db);
}

export function createNotificationProcessorFunction(
  db: JsonDocumentStore,
) {
  return onSchedule(
    {
      schedule: '*/2 * * * *',
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
