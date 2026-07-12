import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  DEFAULT_PUSH_DEVICE_NAMES,
  DEFAULT_PUSH_HOME,
  PUSHOVER_USER_KEY,
} from '@plane-alert/shared';
import { DEVICE_COLLECTION } from '../constants';
import type { DeviceRegistration } from '../types';
import { getDeviceDocId, sanitizeDeviceName } from '../utils';

export async function seedDefaultDeviceRegistrations(
  db: admin.firestore.Firestore,
): Promise<number> {
  const snapshot = await db.collection(DEVICE_COLLECTION).get();
  const hasHouseholdRegistration = snapshot.docs.some((doc) => {
    const data = doc.data() as DeviceRegistration;
    return data.pushoverUserKey === PUSHOVER_USER_KEY;
  });

  if (hasHouseholdRegistration) {
    return 0;
  }

  const timestamp = Date.now();
  let seeded = 0;

  for (const deviceName of DEFAULT_PUSH_DEVICE_NAMES) {
    const deviceSlug = sanitizeDeviceName(deviceName);
    const docId = getDeviceDocId(PUSHOVER_USER_KEY, deviceName);
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