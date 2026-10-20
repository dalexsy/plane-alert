import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import type { DeviceRegistration } from '../types';
import { validatePushoverUserKey } from '../utils';
import { pruneOrphanDeviceRegistrations } from './prune-orphan-registrations';
import { dedupeDeviceRegistrationsByPushoverTarget } from './dedupe-device-registrations';
import { isPwaInstallationRegistration } from './notification-delivery';
import {
  indexPwaInstallationsById,
  isPushoverRegistrationSuppressedByPwa,
} from './device-registration-dedup';
import type { JsonDocumentReference } from './json-document-store-refs';

export type DeviceDoc = {
  ref: JsonDocumentReference;
  id: string;
  data: DeviceRegistration;
};

export async function pruneOrphansForUserKeys(
  db: JsonDocumentStore,
  userKeys: string[],
): Promise<void> {
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
}

export function createPushoverDeviceResolver(): (
  userKey: string,
) => Promise<Set<string> | null> {
  const cache = new Map<string, Set<string> | null>();
  return async (userKey: string) => {
    if (cache.has(userKey)) {
      return cache.get(userKey)!;
    }
    const validation = await validatePushoverUserKey(userKey);
    if (!validation.valid) {
      cache.set(userKey, null);
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
      cache.set(userKey, null);
      return null;
    }
    cache.set(userKey, devices);
    return devices;
  };
}

export async function buildDevicesToNotify(
  activeDevices: DeviceDoc[],
  getRegisteredPushoverDevices: (userKey: string) => Promise<Set<string> | null>,
): Promise<{
  devicesToProcess: DeviceDoc[];
  duplicateRefs: JsonDocumentReference[];
}> {
  const userKeys = [
    ...new Set(
      activeDevices
        .map((entry) => entry.data.pushoverUserKey)
        .filter((key): key is string => typeof key === 'string' && key.length > 0),
    ),
  ];
  const registeredDevicesByUserKey = new Map<string, Set<string>>();
  for (const userKey of userKeys) {
    const devices = await getRegisteredPushoverDevices(userKey);
    if (devices?.size) {
      registeredDevicesByUserKey.set(userKey, devices);
    }
  }

  const pwaDevices = activeDevices.filter((entry) =>
    isPwaInstallationRegistration(entry.id, entry.data),
  );
  const pwaByInstallation = indexPwaInstallationsById(activeDevices);
  const pushoverOnlyDevices = activeDevices.filter((entry) => {
    if (isPwaInstallationRegistration(entry.id, entry.data)) {
      return false;
    }
    return !isPushoverRegistrationSuppressedByPwa(entry, pwaByInstallation);
  });

  const { toProcess: pushoverToProcess, duplicateRefs } =
    dedupeDeviceRegistrationsByPushoverTarget(
      pushoverOnlyDevices,
      registeredDevicesByUserKey,
    );

  return {
    devicesToProcess: [...pushoverToProcess, ...pwaDevices],
    duplicateRefs,
  };
}
