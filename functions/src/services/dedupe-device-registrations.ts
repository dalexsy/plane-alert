import * as admin from 'firebase-admin';
import type { DeviceRegistration } from '../types';
import { inferDeviceName, resolvePushoverDeviceName } from '../utils';

export interface DeviceDocEntry {
  ref: admin.firestore.DocumentReference;
  id: string;
  data: DeviceRegistration;
}

function registrationTimestamp(entry: DeviceDocEntry): number {
  const updatedAt = entry.data.updatedAt;
  if (updatedAt && typeof updatedAt.toMillis === 'function') {
    return updatedAt.toMillis();
  }
  return 0;
}

export interface DedupeDeviceRegistrationsResult {
  toProcess: DeviceDocEntry[];
  duplicateRefs: admin.firestore.DocumentReference[];
}

/**
 * Keep one Firestore registration per Pushover delivery target so parallel
 * notifyForDevice runs cannot send duplicate alerts to the same phone.
 */
export function dedupeDeviceRegistrationsByPushoverTarget(
  devices: DeviceDocEntry[],
  registeredDevicesByUserKey: Map<string, Set<string>>,
): DedupeDeviceRegistrationsResult {
  const keptByTarget = new Map<string, DeviceDocEntry>();
  const duplicateRefs: admin.firestore.DocumentReference[] = [];

  for (const entry of devices) {
    const userKey = entry.data.pushoverUserKey?.trim();
    if (!userKey) {
      continue;
    }

    const registeredDevices = registeredDevicesByUserKey.get(userKey);
    const deviceName = inferDeviceName(entry.id, entry.data);
    const pushoverTarget = resolvePushoverDeviceName(
      deviceName,
      registeredDevices,
      entry.data.platform,
    );

    if (!pushoverTarget) {
      continue;
    }

    const key = `${userKey}__${pushoverTarget.toLowerCase()}`;
    const existing = keptByTarget.get(key);
    if (!existing) {
      keptByTarget.set(key, entry);
      continue;
    }

    if (registrationTimestamp(entry) >= registrationTimestamp(existing)) {
      duplicateRefs.push(existing.ref);
      keptByTarget.set(key, entry);
    } else {
      duplicateRefs.push(entry.ref);
    }
  }

  return {
    toProcess: [...keptByTarget.values()],
    duplicateRefs,
  };
}
