import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from '../types';
import {
  clampRadius,
  inferDeviceName,
  resolvePushoverDeviceName,
  sanitizeDeviceName,
  shouldBroadcastToAllDevices,
} from '../utils';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';
import { getDeviceLocation } from './notification-snapshot-cache';
import type { CachedAircraftSnapshot } from './notification-snapshot-cache';

export interface NotifyDeviceContext {
  deviceLocation: { lat: number; lon: number };
  pushoverTargetDeviceName: string;
  cooldownDeviceName: string;
  deliverToAllDevices: boolean;
  radiusKm: number;
  aircraft: Awaited<ReturnType<typeof resolveAircraftForNotification>>;
}

export async function buildNotifyDeviceContext(
  db: admin.firestore.Firestore,
  device: admin.firestore.DocumentReference,
  data: DeviceRegistration,
  docId: string,
  registeredPushoverDevices?: Set<string> | null,
  cachedSnapshot?: CachedAircraftSnapshot
): Promise<NotifyDeviceContext | null> {
  const broadcastAllDevices = shouldBroadcastToAllDevices();
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

  const pushoverTargetName = broadcastAllDevices
    ? ''
    : resolvePushoverDeviceName(
        data.deviceName || '',
        registeredPushoverDevices,
        data.platform
      );

  const deliverToAllDevices = broadcastAllDevices || pushoverTargetName === null;

  if (!broadcastAllDevices && pushoverTargetName === null) {
    logger.warn('No Pushover device match; broadcasting to all account devices', {
      docId,
      userKey: data.pushoverUserKey.slice(0, 8),
      firestoreDeviceName: data.deviceName,
      pushoverDevices: registeredPushoverDevices
        ? [...registeredPushoverDevices]
        : [],
    });
  }

  if (
    !broadcastAllDevices &&
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
    broadcastAllDevices: deliverToAllDevices,
    radiusKm: data.radiusKm,
    notifyProximity: data.notifyProximity,
    ignoredTypesCount: data.ignoredTypes?.length || 0,
  });

  const pushoverTargetDeviceName = deliverToAllDevices ? '' : pushoverTargetName || '';
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
    deliverToAllDevices,
    radiusKm,
    aircraft,
  };
}
