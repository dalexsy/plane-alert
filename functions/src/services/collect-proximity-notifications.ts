import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { AdsBPlane } from '@plane-alert/shared';
import {
  normalizeCallsign,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  getAircraftTypeName,
  looksMilitary,
  isMilitaryCallsign,
} from '@plane-alert/shared';
import type { DeviceRegistration, Location } from '../types';
import { FRONTEND_BASE_URL, RECENT_NOTIFICATION_TTL_MS } from '../constants';
import { checkAndMarkNotified } from './notification-cooldown';
import type { PendingNotification } from './notification-types';

const PROXIMITY_THRESHOLD_KM = 3.0;

export interface CollectProximityNotificationsParams {
  db: admin.firestore.Firestore;
  docId: string;
  data: DeviceRegistration;
  deviceLocation: Location;
  aircraft: AdsBPlane[];
  cooldownDeviceName: string;
  pushoverTargetDeviceName: string;
  lastProximityNotified: Record<string, number>;
  now: number;
  militaryAndSpecialCount: number;
}

export async function collectProximityNotifications(
  params: CollectProximityNotificationsParams,
): Promise<{
  pending: PendingNotification[];
  lastProximityNotified: Record<string, number>;
}> {
  const {
    db,
    docId,
    data,
    deviceLocation,
    aircraft,
    cooldownDeviceName,
    pushoverTargetDeviceName,
    lastProximityNotified,
    now,
    militaryAndSpecialCount,
  } = params;

  const pending: PendingNotification[] = [];
  const updatedProximityNotified = { ...lastProximityNotified };

  if (data.notifyProximity !== true) {
    return {
      pending,
      lastProximityNotified: updatedProximityNotified,
    };
  }

  logger.info('Checking proximity alerts', {
    docId,
    location: `${deviceLocation.lat},${deviceLocation.lon}`,
    aircraftCount: aircraft.length,
    threshold: PROXIMITY_THRESHOLD_KM,
  });

  let proximityChecked = 0;
  let proximityWithin2km = 0;

  for (const plane of aircraft) {
    const icao = plane.hex?.toUpperCase();
    if (!icao) continue;

    const callsign =
      normalizeCallsign(plane.flight || plane.callsign) ||
      plane.hex.toUpperCase();
    const isMilitaryPlane =
      looksMilitary(plane) ||
      isMilitaryCallsign(plane.flight || plane.callsign) ||
      plane.mil === true ||
      plane.dbFlags === 1;
    if (isMilitaryPlane) {
      continue;
    }

    if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
      continue;
    }

    proximityChecked++;

    const distanceKm = haversineDistanceKm(
      deviceLocation.lat,
      deviceLocation.lon,
      plane.lat,
      plane.lon,
    );

    if (distanceKm <= PROXIMITY_THRESHOLD_KM) {
      const shouldNotify = await checkAndMarkNotified(
        db,
        data.pushoverUserKey,
        cooldownDeviceName,
        icao,
        RECENT_NOTIFICATION_TTL_MS,
      );

      if (!shouldNotify) {
        continue;
      }
      proximityWithin2km++;
      logger.info('Aircraft within 2km detected!', {
        docId,
        icao,
        distanceKm: distanceKm.toFixed(3),
        callsign: callsign || 'unknown',
      });
      const model =
        plane.desc ||
        (plane.t ? getAircraftTypeName(plane.t) : null) ||
        'Aircraft';
      const distanceM = Math.round(distanceKm * 1000);

      const bearing = computeBearing(
        deviceLocation.lat,
        deviceLocation.lon,
        plane.lat,
        plane.lon,
      );
      const direction = bearingToCardinal(bearing);

      pending.push({
        icao,
        deviceName: pushoverTargetDeviceName,
        location: {
          lat: deviceLocation.lat,
          lon: deviceLocation.lon,
          ...(deviceLocation.address && {
            address: deviceLocation.address,
          }),
        },
        message: {
          title: `✈️ Plane Nearby: ${callsign}`,
          message: `${model} • ${direction} • ${distanceM}m away`,
          url: `${FRONTEND_BASE_URL}/?icao=${icao}&follow=1`,
          url_title: 'View on Map',
          icon: `${FRONTEND_BASE_URL}/assets/favicon/android-chrome-192x192.png?v=${Date.now()}`,
          registration: plane.r,
          hex: plane.hex,
        },
        ...(plane.r && { registration: plane.r }),
        ...(plane.lat != null && { lat: plane.lat }),
        ...(plane.lon != null && { lon: plane.lon }),
        ...(bearing != null && { bearing }),
        ...(direction && { cardinal: direction }),
      });

      updatedProximityNotified[icao] = now;
    }
  }

  logger.info('Proximity check complete', {
    docId,
    proximityChecked,
    proximityWithin2km,
    proximityNotificationsSent:
      pending.length - militaryAndSpecialCount,
  });

  return {
    pending,
    lastProximityNotified: updatedProximityNotified,
  };
}
