import { JsonDocumentReference } from './json-document-store-refs';
import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import type { DeviceRegistration } from '../types';
import { MAX_RADIUS_KM } from '../constants';
import {
  clampRadius,
  householdPushoverDeviceTarget,
  inferDeviceName,
  resolvePushoverDeviceName,
  sanitizeDeviceName,
} from '../utils';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';
import { getDeviceLocation } from './notification-snapshot-cache';
import type { CachedAircraftSnapshot } from './notification-snapshot-cache';
import {
  deviceHasNotificationDestination,
  isPwaInstallationRegistration,
  prefersPwaDelivery,
  installationIdForRegistration,
} from './notification-delivery';

export interface NotifyDeviceContext {
  deviceLocation: { lat: number; lon: number };
  pushoverTargetDeviceName: string;
  cooldownDeviceName: string;
  radiusKm: number;
  aircraft: Awaited<ReturnType<typeof resolveAircraftForNotification>>;
}

export async function buildNotifyDeviceContext(
  db: JsonDocumentStore,
  device: JsonDocumentReference,
  data: DeviceRegistration,
  docId: string,
  registeredPushoverDevices?: Set<string> | null,
  cachedSnapshot?: CachedAircraftSnapshot,
  householdTarget?: string,
): Promise<NotifyDeviceContext | null> {
  const deviceLocation = getDeviceLocation(data);
  if (!deviceLocation) {
    return null;
  }

  if (!deviceHasNotificationDestination(data, registeredPushoverDevices, docId)) {
    return null;
  }

  const inferredDeviceName = inferDeviceName(docId, data);
  if (!data.deviceName || data.deviceName !== inferredDeviceName) {
    const slug = sanitizeDeviceName(inferredDeviceName);
    await device.set(
      { deviceName: inferredDeviceName, deviceSlug: slug },
      { merge: true },
    );
    data.deviceName = inferredDeviceName;
    data.deviceSlug = slug;
  }

  const pwaInstall = isPwaInstallationRegistration(docId, data);
  let pushoverTargetName = '';
  let cooldownDeviceName = data.deviceName || docId;

  const needsPushoverResolution =
    Boolean(data.pushoverUserKey?.trim()) &&
    (!pwaInstall || data.pushoverFallbackEnabled === true);

  if (needsPushoverResolution) {
    const resolved = resolvePushoverDeviceName(
      data.deviceName || '',
      registeredPushoverDevices,
      data.platform,
    );

    if (resolved === null && !prefersPwaDelivery(data, docId)) {
      logger.warn('No Pushover device match; skipping this registration', {
        docId,
        userKey: data.pushoverUserKey!.slice(0, 8),
        registrationDeviceName: data.deviceName,
        pushoverDevices: registeredPushoverDevices
          ? [...registeredPushoverDevices]
          : [],
      });
      return null;
    }

    if (resolved) {
      pushoverTargetName = resolved;
      if (!pwaInstall) {
        cooldownDeviceName = resolved;
      }
    }
  }

  if (pwaInstall) {
    const install = installationIdForRegistration(data, docId);
    if (install) {
      cooldownDeviceName = `pwa:${install}`;
    }
    if (!pushoverTargetName) {
      pushoverTargetName = data.deviceName || cooldownDeviceName;
    }
  }

  const pushoverTargetDeviceName =
    householdTarget?.trim() ||
    (pushoverTargetName
      ? householdPushoverDeviceTarget(
          registeredPushoverDevices,
          pushoverTargetName,
        )
      : pushoverTargetName);

  logger.info('Processing device', {
    docId,
    userKey: data.pushoverUserKey?.slice(0, 8),
    deviceName: data.deviceName,
    pushoverDeviceName: pushoverTargetName || undefined,
    householdTarget: pushoverTargetDeviceName || undefined,
    pwaInstall,
    pwaPreferred: prefersPwaDelivery(data, docId),
    radiusKm: data.radiusKm,
    notifyProximity: data.notifyProximity,
    ignoredTypesCount: data.ignoredTypes?.length || 0,
  });

  const radiusKm = cachedSnapshot?.skipRadiusFilter
    ? MAX_RADIUS_KM
    : clampRadius(data.radiusKm);
  const aircraft = await resolveAircraftForNotification(
    deviceLocation,
    radiusKm,
    cachedSnapshot,
    docId,
  );

  logger.info('Fetched aircraft', {
    docId,
    deviceName: data.deviceName,
    totalAircraft: aircraft.length,
  });

  if (!aircraft.length) return null;

  return {
    deviceLocation,
    pushoverTargetDeviceName: pushoverTargetDeviceName || pushoverTargetName,
    cooldownDeviceName,
    radiusKm,
    aircraft,
  };
}
