import { LocalDocumentReference } from './local-firestore-refs';
import * as admin from '../admin-compat';
import type { DeviceRegistration } from '../types';
import { inferDeviceName, resolvePushoverDeviceName } from '../utils';

export interface DeviceDocEntry {
  ref: LocalDocumentReference;
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
  duplicateRefs: LocalDocumentReference[];
}

/**
 * Keep one Firestore registration per Pushover delivery target so parallel
 * notifyForDevice runs cannot send duplicate alerts to the same phone.
 */
/**
 * Keep one Firestore registration per Pushover user key when broadcasting
 * to all devices — duplicate rows would each send the same alert fleet-wide.
 */
export function dedupeToOneRegistrationPerUser(
  devices: DeviceDocEntry[],
): DedupeDeviceRegistrationsResult {
  const keptByUser = new Map<string, DeviceDocEntry>();
  const duplicateRefs: LocalDocumentReference[] = [];

  for (const entry of devices) {
    const userKey = entry.data.pushoverUserKey?.trim();
    if (!userKey) {
      continue;
    }

    const existing = keptByUser.get(userKey);
    if (!existing) {
      keptByUser.set(userKey, entry);
      continue;
    }

    if (registrationTimestamp(entry) >= registrationTimestamp(existing)) {
      duplicateRefs.push(existing.ref);
      keptByUser.set(userKey, entry);
    } else {
      duplicateRefs.push(entry.ref);
    }
  }

  return {
    toProcess: [...keptByUser.values()],
    duplicateRefs,
  };
}

export function dedupeDeviceRegistrationsByPushoverTarget(
  devices: DeviceDocEntry[],
  registeredDevicesByUserKey: Map<string, Set<string>>,
): DedupeDeviceRegistrationsResult {
  const keptByTarget = new Map<string, DeviceDocEntry>();
  const duplicateRefs: LocalDocumentReference[] = [];

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

    const key = pushoverTarget
      ? `${userKey}__${pushoverTarget.toLowerCase()}`
      : `${userKey}__unresolved__${entry.id}`;
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
