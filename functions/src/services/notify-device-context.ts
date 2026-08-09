import { LocalDocumentReference } from './local-firestore-refs';
import { LocalFirestore } from '../local-firestore';
import { logger } from '../pi-logger';
import * as admin from '../admin-compat';
import type { DeviceRegistration } from '../types';
import {
  clampRadius,
  inferDeviceName,
  resolvePushoverDeviceName,
  sanitizeDeviceName,
} from '../utils';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';
import { getDeviceLocation } from './notification-snapshot-cache';
import type { CachedAircraftSnapshot } from './notification-snapshot-cache';

export interface NotifyDeviceContext {
  deviceLocation: { lat: number; lon: number };
  pushoverTargetDeviceName: string;
  cooldownDeviceName: string;
  radiusKm: number;
  aircraft: Awaited<ReturnType<typeof resolveAircraftForNotification>>;
}

export async function buildNotifyDeviceContext(
  db: LocalFirestore,
  device: LocalDocumentReference,
  data: DeviceRegistration,
  docId: string,
  registeredPushoverDevices?: Set<string> | null,
  cachedSnapshot?: CachedAircraftSnapshot
): Promise<NotifyDeviceContext | null> {
  const deviceLocation = getDeviceLocation(data);
  if (!data.pushoverUserKey || !deviceLocation) {
    return null;
  }

  const inferredDeviceName = inferDeviceName(docId, data);
  if (!data.deviceName || data.deviceName !== inferredDeviceName) {
    const slug = sanitizeDeviceName(inferredDeviceName);
    await device.set(
      { deviceName: inferredDeviceName, deviceSlug: slug },
      { merge: true }
    );
    data.deviceName = inferredDeviceName;
    data.deviceSlug = slug;
  }

  const pushoverTargetName = resolvePushoverDeviceName(
    data.deviceName || '',
    registeredPushoverDevices,
    data.platform
  );

  if (pushoverTargetName === null) {
    logger.warn('No Pushover device match; skipping this registration', {
      docId,
      userKey: data.pushoverUserKey.slice(0, 8),
      firestoreDeviceName: data.deviceName,
      pushoverDevices: registeredPushoverDevices
        ? [...registeredPushoverDevices]
        : [],
    });
    return null;
  }

  if (
    pushoverTargetName &&
    pushoverTargetName !== data.deviceName
  ) {
    logger.info('Resolved Pushover device alias', {
      docId,
      firestoreDeviceName: data.deviceName,
      pushoverDeviceName: pushoverTargetName,
    });
  }

  logger.info('Processing device', {
    docId,
    userKey: data.pushoverUserKey.slice(0, 8),
    deviceName: data.deviceName,
    pushoverDeviceName: pushoverTargetName,
    radiusKm: data.radiusKm,
    notifyProximity: data.notifyProximity,
    ignoredTypesCount: data.ignoredTypes?.length || 0,
  });

  const pushoverTargetDeviceName = pushoverTargetName;
  const radiusKm = clampRadius(data.radiusKm);
  const aircraft = await resolveAircraftForNotification(
    deviceLocation,
    radiusKm,
    cachedSnapshot,
    docId
  );

  logger.info('Fetched aircraft', {
    docId,
    deviceName: data.deviceName,
    totalAircraft: aircraft.length,
  });

  if (!aircraft.length) return null;

  return {
    deviceLocation,
    pushoverTargetDeviceName,
    cooldownDeviceName: pushoverTargetDeviceName,
    radiusKm,
    aircraft,
  };
}
