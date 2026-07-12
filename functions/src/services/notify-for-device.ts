import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from '../types';
import { pruneOldNotifications } from '../utils';
import { batchGetFlightData } from './flight-data-cache';
import { collectMilitaryNotifications } from './collect-military-notifications';
import { collectProximityNotifications } from './collect-proximity-notifications';
import { deliverDeviceNotifications } from './deliver-device-notifications';
import type { CachedAircraftSnapshot } from './notification-snapshot-cache';
import { buildNotifyDeviceContext } from './notify-device-context';

export async function notifyForDevice(
  db: admin.firestore.Firestore,
  device: admin.firestore.DocumentReference,
  data: DeviceRegistration,
  docId: string,
  registeredPushoverDevices?: Set<string> | null,
  cachedSnapshot?: CachedAircraftSnapshot,
): Promise<void> {
  try {
    const ctx = await buildNotifyDeviceContext(
      db,
      device,
      data,
      docId,
      registeredPushoverDevices,
      cachedSnapshot,
    );
    if (!ctx) return;

    const {
      deviceLocation,
      aircraft,
      radiusKm,
      cooldownDeviceName,
      pushoverTargetDeviceName,
    } = ctx;

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

    const seenIcaos = new Set<string>();
    const pendingNotifications = [...militaryPending, ...proximityPending].filter(
      (pending) => {
        if (seenIcaos.has(pending.icao)) {
          return false;
        }
        seenIcaos.add(pending.icao);
        return true;
      },
    );

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
