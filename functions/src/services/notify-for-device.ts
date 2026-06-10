import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { AdsBPlane } from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import {
  clampRadius,
  inferDeviceName,
  resolvePushoverDeviceName,
  sanitizeDeviceName,
  pruneOldNotifications,
  shouldBroadcastToAllDevices,
} from '../utils';
import { fetchAircraftForCollection } from './aircraft-collection-fetch';
import { batchGetFlightData } from './flight-data-cache';
import { collectMilitaryNotifications } from './collect-military-notifications';
import { collectProximityNotifications } from './collect-proximity-notifications';
import { deliverDeviceNotifications } from './deliver-device-notifications';
import {
  getDeviceLocation,
  isSnapshotStale,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import type { Location } from '../types';

async function resolveAircraftForNotification(
  deviceLocation: Location,
  radiusKm: number,
  cachedSnapshot: CachedAircraftSnapshot | undefined,
  docId: string,
): Promise<AdsBPlane[]> {
  const useCache =
    cachedSnapshot &&
    cachedSnapshot.aircraft.length > 0 &&
    !isSnapshotStale(cachedSnapshot.snapshotAgeMs);

  if (useCache) {
    return cachedSnapshot.aircraft;
  }

  const fresh = await fetchAircraftForCollection(deviceLocation, radiusKm);
  if (fresh !== null && fresh.length > 0) {
    logger.info('Refetched aircraft for notifications', {
      docId,
      aircraftCount: fresh.length,
      hadStaleCache: Boolean(cachedSnapshot?.aircraft.length),
      snapshotAgeMs: cachedSnapshot?.snapshotAgeMs,
    });
    return fresh;
  }

  if (cachedSnapshot?.aircraft.length) {
    logger.warn('ADS-B fetch failed; using cached aircraft snapshot', {
      docId,
      aircraftCount: cachedSnapshot.aircraft.length,
      snapshotAgeMs: cachedSnapshot.snapshotAgeMs,
    });
    return cachedSnapshot.aircraft;
  }

  return fresh ?? [];
}

export async function notifyForDevice(
  db: admin.firestore.Firestore,
  device: admin.firestore.DocumentReference,
  data: DeviceRegistration,
  docId: string,
  registeredPushoverDevices?: Set<string> | null,
  cachedSnapshot?: CachedAircraftSnapshot,
): Promise<void> {
  try {
    const broadcastAllDevices = shouldBroadcastToAllDevices();
    const deviceLocation = getDeviceLocation(data);
    if (!data.pushoverUserKey || !deviceLocation) {
      return;
    }

    const inferredDeviceName = inferDeviceName(docId, data);
    if (!data.deviceName || data.deviceName !== inferredDeviceName) {
      const slug = sanitizeDeviceName(inferredDeviceName);
      await device.set(
        {
          deviceName: inferredDeviceName,
          deviceSlug: slug,
        },
        { merge: true },
      );
      data.deviceName = inferredDeviceName;
      data.deviceSlug = slug;
    }

    const pushoverTargetName = broadcastAllDevices
      ? ''
      : resolvePushoverDeviceName(data.deviceName || '', registeredPushoverDevices);

    if (!broadcastAllDevices && !pushoverTargetName) {
      logger.info('Skipping device not registered in Pushover', {
        docId,
        userKey: data.pushoverUserKey.slice(0, 8),
        deviceName: data.deviceName,
        pushoverDevices: registeredPushoverDevices
          ? [...registeredPushoverDevices]
          : [],
      });
      return;
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
      broadcastAllDevices,
      radiusKm: data.radiusKm,
      notifyProximity: data.notifyProximity,
      ignoredTypesCount: data.ignoredTypes?.length || 0,
    });

    const cooldownDeviceName = broadcastAllDevices ? '' : data.deviceName || '';
    const pushoverTargetDeviceName = broadcastAllDevices
      ? ''
      : pushoverTargetName || '';

    const radiusKm = clampRadius(data.radiusKm);
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

    if (!aircraft.length) {
      return;
    }

    const planesWithFlight = aircraft.filter((plane) =>
      Boolean(plane.flight && plane.flight.trim()),
    );
    const militaryPlanesWithFlight = planesWithFlight.filter(
      (plane) => plane.mil === true || plane.dbFlags === 1,
    );
    const callsigns = militaryPlanesWithFlight.map((plane) =>
      plane.flight!.trim(),
    );

    logger.info('Selecting callsigns for flight data', {
      docId,
      totalAircraft: aircraft.length,
      planesWithFlight: planesWithFlight.length,
      militaryWithFlight: militaryPlanesWithFlight.length,
      milFieldTrue: planesWithFlight.filter((p) => p.mil === true).length,
      dbFlagsIs1: planesWithFlight.filter((p) => p.dbFlags === 1).length,
      callsignsFound: callsigns.length,
      sampleCallsigns: callsigns.slice(0, 5),
    });

    const flightDataMap =
      callsigns.length > 0
        ? await batchGetFlightData(db, callsigns)
        : new Map();

    if (callsigns.length > 0) {
      logger.info('Fetched flight data for notifications', {
        docId,
        callsignsQueried: callsigns.length,
        dataReceived: flightDataMap.size,
      });
    }

    const lastNotified = pruneOldNotifications(data.lastNotified ?? {});
    const lastProximityNotified = pruneOldNotifications(
      data.lastProximityNotified ?? {},
    );
    const now = Date.now();

    const { pending: militaryPending, stats } =
      await collectMilitaryNotifications({
        db,
        docId,
        data,
        deviceLocation,
        aircraft,
        radiusKm,
        cooldownDeviceName,
        pushoverTargetDeviceName,
        flightDataMap,
      });

    const { pending: proximityPending, lastProximityNotified: updatedProximity } =
      await collectProximityNotifications({
        db,
        docId,
        data,
        deviceLocation,
        aircraft,
        cooldownDeviceName,
        pushoverTargetDeviceName,
        lastProximityNotified,
        now,
        militaryAndSpecialCount: stats.militaryCount + stats.specialCount,
      });

    const pendingNotifications = [...militaryPending, ...proximityPending];

    logger.info('Aircraft filtering results', {
      docId,
      totalAircraft: aircraft.length,
      militaryFlagged: stats.militaryCount + stats.boringCount,
      interestingMilitary: stats.militaryCount,
      boringMilitary: stats.boringCount,
      specialCount: stats.specialCount,
      recentlyNotifiedCount: stats.recentlyNotifiedCount,
      messagesToSend: pendingNotifications.length,
    });

    if (!pendingNotifications.length) {
      await device.set(
        { lastNotified, lastProximityNotified: updatedProximity },
        { merge: true },
      );
      return;
    }

    const updatedLastNotified = await deliverDeviceNotifications({
      db,
      docId,
      data,
      cooldownDeviceName,
      pendingNotifications,
      lastNotified,
      now,
    });

    await device.set(
      {
        lastNotified: updatedLastNotified,
        lastProximityNotified: updatedProximity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    logger.error('notifyForDevice exception', {
      docId,
      error: err?.message,
      stack: err?.stack,
    });
    throw error;
  }
}
