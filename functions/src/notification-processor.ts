import { JsonDocumentStore } from './json-document-store';
import { onSchedule } from './on-request';
import { logger } from './pi-logger';
import type { DeviceRegistration } from './types';
import { DEVICE_COLLECTION } from './constants';
import { processDevicesWithSnapshotCache } from './services/process-devices-notifications';
import {
  buildDevicesToNotify,
  createPushoverDeviceResolver,
  pruneOrphansForUserKeys,
} from './services/notification-processor-prepare';
import {
  recordProcessPlanesFailure,
  recordProcessPlanesStart,
  recordProcessPlanesSuccess,
  releaseProcessPlanesLock,
  tryAcquireProcessPlanesLock,
} from './services/notification-health';
import { isNotificationProcessingEnabled } from './services/notification-processing-enabled';

export async function runNotificationProcessing(
  db: JsonDocumentStore,
): Promise<void> {
  if (!isNotificationProcessingEnabled()) {
    logger.info('Skipping processPlanes — no notification transport enabled');
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

  await pruneOrphansForUserKeys(db, userKeys);

  const activeSnapshot = await db.collection(DEVICE_COLLECTION).get();
  const activeDevices = activeSnapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    data: doc.data() as unknown as DeviceRegistration,
  }));

  await recordProcessPlanesStart(db, activeDevices.length);

  const getRegisteredPushoverDevices = createPushoverDeviceResolver();
  const { devicesToProcess, duplicateRefs } = await buildDevicesToNotify(
    activeDevices,
    getRegisteredPushoverDevices,
  );

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
