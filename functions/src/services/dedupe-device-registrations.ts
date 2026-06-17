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

/**
 * Keep one Firestore registration per Pushover delivery target so parallel
 * notifyForDevice runs cannot send duplicate alerts to the same phone.
 */
export function dedupeDeviceRegistrationsByPushoverTarget(
  devices: DeviceDocEntry[],
  registeredDevicesByUserKey: Map<string, Set<string>>,
): DeviceDocEntry[] {
  const keptByTarget = new Map<string, DeviceDocEntry>();
  const unmatched: DeviceDocEntry[] = [];

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
      unmatched.push(entry);
      continue;
    }

    const key = `${userKey}__${pushoverTarget.toLowerCase()}`;
    const existing = keptByTarget.get(key);
    if (
      !existing ||
      registrationTimestamp(entry) >= registrationTimestamp(existing)
    ) {
      keptByTarget.set(key, entry);
    }
  }

  return [...keptByTarget.values(), ...unmatched];
}
