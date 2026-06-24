import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  matchPushoverDeviceName,
  PUSHOVER_UNRELIABLE_DEVICE_NAMES,
} from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { DEVICE_COLLECTION } from '../constants';
import {
  getDeviceDocId,
  inferDeviceName,
  sanitizeDeviceName,
} from '../utils';
import { fetchDeviceDocsForUserKey } from './device-list-formatting';

function registrationTimestamp(
  data: DeviceRegistration | undefined,
): number {
  const updatedAt = data?.updatedAt;
  if (updatedAt && typeof updatedAt.toMillis === 'function') {
    return updatedAt.toMillis();
  }
  return 0;
}

function pickTemplateRegistration(
  registrations: Array<{ data: DeviceRegistration }>,
): DeviceRegistration | null {
  if (!registrations.length) {
    return null;
  }

  return registrations.reduce((best, entry) =>
    registrationTimestamp(entry.data) >= registrationTimestamp(best.data)
      ? entry
      : best,
  ).data;
}

/**
 * Ensure every reliable Pushover device on the account has a Firestore
 * registration when the user already has at least one active registration.
 * Restores phones that were dropped by duplicate pruning without requiring
 * the user to open the app again on each device.
 */
export async function syncMissingPushoverDeviceRegistrations(
  db: admin.firestore.Firestore,
  pushoverUserKey: string,
  pushoverDevices: string[],
): Promise<number> {
  const docs = await fetchDeviceDocsForUserKey(db, pushoverUserKey);
  const registrations = [...docs.values()]
    .filter((doc) => doc.exists)
    .map((doc) => ({
      id: doc.id,
      data: doc.data() as DeviceRegistration,
    }));

  if (!registrations.length) {
    return 0;
  }

  const coveredTargets = new Set<string>();
  for (const entry of registrations) {
    const deviceName = inferDeviceName(entry.id, entry.data);
    const matched = matchPushoverDeviceName(deviceName, pushoverDevices);
    if (
      matched &&
      !PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(matched.toLowerCase())
    ) {
      coveredTargets.add(matched.toLowerCase());
    }
  }

  const template = pickTemplateRegistration(registrations);
  if (!template) {
    return 0;
  }

  const templateLocation = template.location || (template as any).home;
  if (
    !templateLocation ||
    typeof templateLocation.lat !== 'number' ||
    typeof templateLocation.lon !== 'number'
  ) {
    return 0;
  }

  let created = 0;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  for (const pushoverDevice of pushoverDevices) {
    const trimmed = pushoverDevice.trim();
    if (!trimmed) {
      continue;
    }
    if (PUSHOVER_UNRELIABLE_DEVICE_NAMES.has(trimmed.toLowerCase())) {
      continue;
    }
    if (coveredTargets.has(trimmed.toLowerCase())) {
      continue;
    }

    const docId = getDeviceDocId(pushoverUserKey, trimmed);
    const docRef = db.collection(DEVICE_COLLECTION).doc(docId);
    const existing = await docRef.get();
    if (existing.exists) {
      coveredTargets.add(trimmed.toLowerCase());
      continue;
    }

    const payload: DeviceRegistration = {
      pushoverUserKey,
      deviceName: trimmed,
      deviceSlug: sanitizeDeviceName(trimmed),
      platform: 'auto-synced',
      distanceUnit: template.distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: template.radiusKm,
      timezone: template.timezone,
      location: templateLocation,
      specialIcaos: Array.isArray(template.specialIcaos)
        ? template.specialIcaos
        : [],
      notifyProximity: template.notifyProximity === true,
      ignoredTypes: Array.isArray(template.ignoredTypes)
        ? template.ignoredTypes
        : [],
      createdAt: timestamp as any,
      updatedAt: timestamp as any,
    };

    await docRef.set(payload, { merge: true });
    created += 1;
    logger.info('Restored missing Pushover device registration', {
      userKey: pushoverUserKey.slice(0, 8),
      deviceName: trimmed,
      templateDevice: inferDeviceName(
        registrations[0].id,
        registrations[0].data,
      ),
    });
  }

  return created;
}
