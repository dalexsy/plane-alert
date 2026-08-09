import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import type { AdsBPlane } from '@plane-alert/shared';
import {
  haversineDistanceKm,
  isBoringMilitaryAircraft,
  isMilitaryCallsign,
  shouldAlertForAircraft,
} from '@plane-alert/shared';
import type { DeviceRegistration, Location } from '../types';
import {
  MAX_NOTIFICATIONS_PER_DEVICE,
  RECENT_NOTIFICATION_TTL_MS,
} from '../constants';
import { checkAndMarkNotified } from './notification-cooldown';
import { buildMilitaryPendingNotification } from './build-military-notification';
import type { FlightData } from './aeroapi-client';
import type {
  MilitaryCollectionStats,
  PendingNotification,
} from './notification-types';

export interface CollectMilitaryNotificationsParams {
  db: JsonDocumentStore;
  docId: string;
  data: DeviceRegistration;
  deviceLocation: Location;
  aircraft: AdsBPlane[];
  radiusKm: number;
  cooldownDeviceName: string;
  pushoverTargetDeviceName: string;
  flightDataMap: Map<string, FlightData>;
}

export async function collectMilitaryNotifications(
  params: CollectMilitaryNotificationsParams,
): Promise<{
  pending: PendingNotification[];
  stats: MilitaryCollectionStats;
}> {
  const {
    db,
    docId,
    data,
    deviceLocation,
    aircraft,
    radiusKm,
    cooldownDeviceName,
    pushoverTargetDeviceName,
    flightDataMap,
  } = params;

  const pending: PendingNotification[] = [];
  const stats: MilitaryCollectionStats = {
    militaryCount: 0,
    specialCount: 0,
    boringCount: 0,
    recentlyNotifiedCount: 0,
  };

  const specialIcaos = (data.specialIcaos ?? []).map((icao) =>
    icao.toUpperCase(),
  );

  if (aircraft.length > 0) {
    logger.info('Sample aircraft data', {
      docId,
      sample: aircraft.slice(0, 5).map((p) => ({
        hex: p.hex,
        flight: p.flight,
        r: p.r,
        t: p.t,
        mil: p.mil,
        dbFlags: p.dbFlags,
        desc: p.desc,
      })),
    });
  }

  for (const plane of aircraft) {
    const icao = plane.hex?.toUpperCase();
    if (!icao) {
      continue;
    }

    const isSpecialPlane = specialIcaos.includes(icao);
    const callsign = plane.flight || plane.callsign;
    const dbMil = plane.mil === true || plane.dbFlags === 1;
    const prefixMil = isMilitaryCallsign(callsign);
    const isMilitaryCandidate = prefixMil || dbMil;

    if (data.ignoredTypes?.some((type) => type.trim() === '*') && !isSpecialPlane) {
      continue;
    }

    // Same gate as kiosk/SPA audio — shared shouldAlertForAircraft.
    if (!shouldAlertForAircraft(plane, { isSpecial: isSpecialPlane })) {
      if (isMilitaryCandidate && isBoringMilitaryAircraft(plane)) {
        stats.boringCount++;
        logger.info('Boring military aircraft filtered', {
          docId,
          hex: plane.hex,
          type: plane.t,
          desc: plane.desc,
          callsign: plane.flight,
          mil: plane.mil,
          dbFlags: plane.dbFlags,
        });
      }
      continue;
    }

    const isMilitary = isMilitaryCandidate;

    const aircraftType2 = (plane.t || plane.desc || '').toUpperCase();
    const ignoredTypes = data.ignoredTypes || [];
    const isIgnored = ignoredTypes.some((ignoredType) => {
      const upperIgnored = ignoredType.toUpperCase();
      return (
        aircraftType2.includes(upperIgnored) ||
        (plane.desc && plane.desc.toUpperCase().includes(upperIgnored))
      );
    });

    if (isIgnored && !isSpecialPlane) {
      continue;
    }

    if (isMilitary) {
      stats.militaryCount++;
    }
    if (isSpecialPlane) {
      stats.specialCount++;
    }

    if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
      logger.info('Military aircraft missing coordinates', {
        docId,
        hex: plane.hex,
        type: plane.t,
        callsign: plane.flight,
      });
      continue;
    }

    const distanceKm = haversineDistanceKm(
      deviceLocation.lat,
      deviceLocation.lon,
      plane.lat,
      plane.lon,
    );
    if (distanceKm > radiusKm) {
      logger.info('Military aircraft outside radius', {
        docId,
        hex: plane.hex,
        type: plane.t,
        callsign: plane.flight,
        distanceKm: Math.round(distanceKm * 10) / 10,
        radiusKm,
      });
      continue;
    }

    const shouldNotify = await checkAndMarkNotified(
      db,
      data.pushoverUserKey,
      cooldownDeviceName,
      icao,
      RECENT_NOTIFICATION_TTL_MS,
    );

    if (!shouldNotify) {
      stats.recentlyNotifiedCount++;
      continue;
    }

    const notification = await buildMilitaryPendingNotification(
      plane,
      data,
      deviceLocation,
      pushoverTargetDeviceName,
      flightDataMap,
    );
    // Backup if in-range scan missed this visit; cooldown skips duplicate play.
    notification.playKioskAlert = true;
    pending.push(notification);

    if (pending.length >= MAX_NOTIFICATIONS_PER_DEVICE) {
      break;
    }
  }

  return { pending, stats };
}
