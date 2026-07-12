import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  isValidDeviceRegistration,
  matchPushoverDeviceName,
  PUSHOVER_UNRELIABLE_DEVICE_NAMES,
} from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { inferDeviceName } from '../utils';
import { fetchDeviceDocsForUserKey } from './device-list-formatting';

export async function pruneOrphanDeviceRegistrations(
  db: admin.firestore.Firestore,
  pushoverUserKey: string,
  pushoverDevices: string[],
): Promise<number> {
  const docs = await fetchDeviceDocsForUserKey(db, pushoverUserKey);
  let removed = 0;

  for (const [docId, doc] of docs) {
    if (!doc.exists) {
      continue;
    }
    const data = doc.data() as DeviceRegistration;
    const deviceName = inferDeviceName(docId, data);

    if (matchPushoverDeviceName(deviceName, pushoverDevices)) {
      if (!PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(deviceName.toLowerCase())) {
        continue;
      }
    } else if (
      isValidDeviceRegistration(deviceName, data.platform, pushoverDevices)
    ) {
      continue;
    }

    await doc.ref.delete();
    removed += 1;
    logger.info('Pruned orphan device registration', {
      docId,
      deviceName,
      userKey: pushoverUserKey.slice(0, 8),
    });
  }

  return removed;
}
