import { LocalFirestore } from '../local-firestore';
import { logger } from '../pi-logger';
import * as admin from '../admin-compat';
import {
  DEFAULT_PUSH_DEVICE_NAMES,
  DEFAULT_PUSH_HOME,
  PUSHOVER_USER_KEY,
} from '@plane-alert/shared';
import { DEVICE_COLLECTION } from '../constants';
import type { DeviceRegistration } from '../types';
import { getDeviceDocId, sanitizeDeviceName } from '../utils';

export async function seedDefaultDeviceRegistrations(
  db: LocalFirestore,
): Promise<number> {
  const snapshot = await db.collection(DEVICE_COLLECTION).get();
  const existingIds = new Set(snapshot.docs.map((doc) => doc.id));

  const timestamp = Date.now();
  let seeded = 0;

  const deviceNames = Array.isArray(DEFAULT_PUSH_DEVICE_NAMES)
    ? DEFAULT_PUSH_DEVICE_NAMES
    : [];

  for (const deviceName of deviceNames) {
    const deviceSlug = sanitizeDeviceName(deviceName);
    const docId = getDeviceDocId(PUSHOVER_USER_KEY, deviceName);
    if (existingIds.has(docId)) {
      continue;
    }
    const doc: DeviceRegistration = {
      pushoverUserKey: PUSHOVER_USER_KEY,
      platform: 'auto-synced',
      distanceUnit: 'km',
      radiusKm: 100,
      timezone: 'Europe/Berlin',
      location: { ...DEFAULT_PUSH_HOME },
      specialIcaos: [],
      notifyProximity: false,
      ignoredTypes: [],
      deviceName,
      deviceSlug,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.collection(DEVICE_COLLECTION).doc(docId).set(doc, { merge: true });
    seeded += 1;
  }

  if (seeded > 0) {
    logger.info('Seeded default Pushover device registrations', {
      userKey: PUSHOVER_USER_KEY.slice(0, 8),
      seeded,
    });
  }

  return seeded;
}