import { JsonDocumentReference } from './json-document-store-refs';
import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import type { DeviceRegistration } from '../types';
import { householdTargetFromRegistrations } from '../utils';
import { notifyForDevice } from './notify-for-device';
import {
  mergeHouseholdInRangeAircraft,
  pickHouseholdPrimary,
} from './household-notify';
import { chimeKioskForMilitaryInRange } from './kiosk-military-in-range-chime';
import {
  loadAircraftSnapshotCache,
  uniqueLocationKeysFromDevices,
} from './notification-snapshot-cache';

type DeviceDoc = {
  ref: JsonDocumentReference;
  id: string;
  data: DeviceRegistration;
};

export async function processDevicesWithSnapshotCache(
  db: JsonDocumentStore,
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

    const householdTarget = householdTargetFromRegistrations(
      entries,
      registeredPushoverDevices,
    );

    if (entries.length > 1) {
      logger.info('Household Pushover registrations', {
        userKey: userKey.slice(0, 8),
        registrationCount: entries.length,
        householdTarget,
      });
    }

    const primary = pickHouseholdPrimary(entries);
    const cachedSnapshot = mergeHouseholdInRangeAircraft(
      entries,
      aircraftCache,
    );

    await notifyForDevice(
      db,
      primary.ref,
      primary.data,
      primary.id,
      registeredPushoverDevices,
      cachedSnapshot,
      householdTarget,
    ).catch((error) =>
      logger.error('notifyForDevice failed', {
        docId: primary.id,
        deviceName: primary.data.deviceName,
        userKey: primary.data.pushoverUserKey?.slice(0, 8),
        error,
      }),
    );
  });

  await Promise.all(tasks);
}
