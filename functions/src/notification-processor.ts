import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as countries from 'i18n-iso-countries';
import type {
  AdsBPlane,
  AircraftDbEntry,
  AircraftDbMetadata,
} from '@plane-alert/shared';
import {
  normalizeCallsign,
  getAircraftCountry,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  formatDistance,
  getCountryFlagEmoji,
  createAircraftLookupMap,
  looksMilitary,
  formatNotificationTitle,
  BORING_AIRCRAFT_TYPES,
  getAircraftTypeName,
} from '@plane-alert/shared';
import type { DeviceRegistration, Location } from './types';
import {
  DEVICE_COLLECTION,
  COOLDOWN_COLLECTION,
  MILITARY_HISTORY_COLLECTION,
  MAX_NOTIFICATIONS_PER_DEVICE,
  RECENT_NOTIFICATION_TTL_MS,
} from './constants';
import {
  clampRadius,
  inferDeviceName,
  sanitizeDeviceName,
  pruneOldNotifications,
  isSpecialAircraft,
} from './utils';
// Import service modules
import { fetchAircraft } from './services/aircraft-fetcher';
import {
  fetchAircraftImage,
  downloadAndEncodeImage,
} from './services/image-fetcher';
import { reverseGeocode } from './services/geocoding';
import {
  getOperatorFromCallsign,
  buildNotificationBody,
} from './services/notification-builder';
import { checkAndMarkNotified } from './services/notification-cooldown';
import {
  sendPushoverNotification,
  sendPushoverNotifications,
  type PushoverMessage,
} from './services/pushover-client';
import { batchGetFlightData } from './services/flight-data-cache';

// Import user aircraft database (not used for military detection - only for special aircraft)
import userAircraftDb from './data/user-aircraft-db.json';

// Create a lookup map for user aircraft database using shared utility (not used for military detection)
// const userAircraftLookup = createAircraftLookupMap(
//   userAircraftDb as Array<AircraftDbEntry | AircraftDbMetadata>,
// );

function getTimestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

async function notifyForDevice(
  db: admin.firestore.Firestore,
  device: any,
  data: DeviceRegistration,
  docId: string,
): Promise<void> {
  try {
    const broadcastAllDevices =
      String(process.env.PUSHOVER_BROADCAST_ALL_DEVICES || '').toLowerCase() ===
      'true';

    // Support both new 'location' field and legacy 'home' field
    const deviceLocation = data.location || (data as any).home;
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
      : data.deviceName || '';

    const radiusKm = clampRadius(data.radiusKm);
    const aircraft = await fetchAircraft(deviceLocation, radiusKm);

    logger.info('Fetched aircraft', {
      docId,
      deviceName: data.deviceName,
      totalAircraft: aircraft.length,
    });

    if (!aircraft.length) {
      return;
    }

    // Fetch flight data for MILITARY aircraft only (cost control)
    // Note: AeroAPI often has no data for many ADS-B callsigns; querying everything is prohibitively expensive.
    const planesWithFlight = aircraft.filter((plane) =>
      Boolean(plane.flight && plane.flight.trim()),
    );
    const militaryPlanesWithFlight = planesWithFlight.filter((plane) => {
      return plane.mil === true || plane.dbFlags === 1;
    });
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
    const messages: PushoverMessage[] = [];
    const now = Date.now();

    const specialIcaos = (data.specialIcaos ?? []).map((icao) =>
      icao.toUpperCase(),
    );

    let militaryCount = 0;
    let specialCount = 0;
    let boringCount = 0;
    let recentlyNotifiedCount = 0;

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

      // Trust ONLY the ADS-B API military flags - don't use user database for military detection
      const isMilitary = plane.mil === true || plane.dbFlags === 1;

      if (!isMilitary && !isSpecialPlane) {
        continue;
      }

      // Filter out boring military types (transports, trainers, commercial aircraft used by military)
      const aircraftType = (plane.t || plane.type || '')
        .toUpperCase()
        .replace(/[-\s]/g, '');
      const isBoringMilitary = BORING_AIRCRAFT_TYPES.some((boring) =>
        aircraftType.includes(boring.toUpperCase()),
      );

      if (isBoringMilitary && !isSpecialPlane) {
        boringCount++;
        logger.info('Boring military aircraft filtered', {
          docId,
          hex: plane.hex,
          type: plane.t,
          desc: plane.desc,
          callsign: plane.flight,
          mil: plane.mil,
          dbFlags: plane.dbFlags,
        });
        continue;
      }

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
        militaryCount++;
      }
      if (isSpecialPlane) {
        specialCount++;
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
        recentlyNotifiedCount++;
        continue;
      }

      const bearing = computeBearing(
        deviceLocation.lat,
        deviceLocation.lon,
        plane.lat,
        plane.lon,
      );
      const direction = bearingToCardinal(bearing);
      const distance = formatDistance(
        distanceKm,
        data.distanceUnit === 'miles' ? 'miles' : 'km',
      );

      const rawCountry = (plane as any).ctry ?? (plane as any).countryCode;
      const countryResult = getAircraftCountry(
        plane.r,
        plane.hex,
        rawCountry,
        isMilitary,
      );

      const countryCode =
        countryResult.countryCode !== 'Unknown'
          ? countryResult.countryCode
          : null;
      const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

      const icaoUpper = plane.hex.toUpperCase();
      const callsign = normalizeCallsign(plane.flight || plane.callsign);
      // Convert ICAO type code to readable name (e.g., "B738" -> "Boeing 737-800")
      const model =
        plane.desc || (plane.t ? getAircraftTypeName(plane.t) : plane.t);

      // Get flight data if available for this aircraft (AeroAPI enrichment)
      const flightData = callsign
        ? flightDataMap.get(callsign.toUpperCase())
        : undefined;

      // If no model, the title will contain the callsign, so skip it in the body
      const skipCallsignInBody = !model;
      const body = await buildNotificationBody(
        plane,
        distance,
        direction,
        bearing,
        data.distanceUnit === 'miles' ? 'miles' : 'km',
        skipCallsignInBody,
        flightData,
      );

      // Use shared formatting function for consistent title format
      let title = formatNotificationTitle(
        flagEmoji,
        model,
        callsign,
        icaoUpper,
      );

      // Add special emoji prefixes for specific aircraft
      if (model) {
        const modelUpper = model.toUpperCase();
        if (modelUpper.includes('A400') || modelUpper.includes('A-400')) {
          title = '🦜 ' + title;
        } else if (
          modelUpper.includes('E-3') ||
          modelUpper.includes('SENTRY')
        ) {
          title = '🛸 ' + title;
        }
      }

      const iconPath = isSpecialAircraft(icaoUpper)
        ? 'favicon/special'
        : 'favicon/military';
      const iconUrl = `https://plane-alert.surge.sh/assets/${iconPath}/android-chrome-192x192.png?v=${Date.now()}`;

      messages.push({
        title: title,
        message: body,
        url: `https://plane-alert.surge.sh/?lat=${plane.lat}&lon=${plane.lon}&zoom=12`,
        url_title: 'View Location',
        icon: iconUrl,
        model: plane.t || plane.desc,
        operator: plane.desc,
        registration: plane.r,
        hex: plane.hex,
      });

      lastNotified[icao] = now;

      // Save to military history when notifying (backend-authoritative record)
      const historyDocId = `${data.pushoverUserKey}__${icao.toLowerCase()}`;
      const historyRef = db.collection(MILITARY_HISTORY_COLLECTION).doc(historyDocId);
      const existingSighting = await historyRef.get();
      if (existingSighting.exists) {
        const existing = existingSighting.data()!;
        historyRef.update({
          lastSeen: now,
          sightingCount: (existing.sightingCount || 1) + 1,
          ...(plane.lat != null && { lat: plane.lat }),
          ...(plane.lon != null && { lon: plane.lon }),
          ...(plane.alt_baro != null && { altitude: plane.alt_baro }),
          ...(bearing != null && { bearing }),
          ...(direction && { cardinal: direction }),
          ...(callsign && { callsign }),
          ...(model && { model }),
          ...(countryCode && { country: countryCode }),
          ...(plane.r && { registration: plane.r }),
        }).catch((err: Error) => logger.warn('Failed to update military history', { err: err.message }));
      } else {
        historyRef.set({
          icao: icao.toLowerCase(),
          firstSeen: now,
          lastSeen: now,
          sightingCount: 1,
          ...(callsign && { callsign }),
          ...(model && { model }),
          ...(countryCode && { country: countryCode }),
          ...(plane.r && { registration: plane.r }),
          ...(plane.lat != null && { lat: plane.lat }),
          ...(plane.lon != null && { lon: plane.lon }),
          ...(plane.alt_baro != null && { altitude: plane.alt_baro }),
          ...(bearing != null && { bearing }),
          ...(direction && { cardinal: direction }),
        }).catch((err: Error) => logger.warn('Failed to save military history', { err: err.message }));
      }

      if (messages.length >= MAX_NOTIFICATIONS_PER_DEVICE) {
        break;
      }
    }

    // Proximity notifications
    const lastProximityNotified = pruneOldNotifications(
      data.lastProximityNotified ?? {},
    );
    const PROXIMITY_THRESHOLD_KM = 3.0;
    const PROXIMITY_NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

    if (data.notifyProximity === true) {
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

        const shouldNotify = await checkAndMarkNotified(
          db,
          data.pushoverUserKey,
          cooldownDeviceName,
          `proximity_${icao}`,
          PROXIMITY_NOTIFICATION_COOLDOWN_MS,
        );

        if (!shouldNotify) {
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
          proximityWithin2km++;
          logger.info('Aircraft within 2km detected!', {
            docId,
            icao,
            distanceKm: distanceKm.toFixed(3),
            callsign: plane.flight || plane.callsign || 'unknown',
          });
          const callsign =
            normalizeCallsign(plane.flight || plane.callsign) ||
            plane.hex.toUpperCase();
          // Convert ICAO type code to readable name
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

          messages.push({
            title: `✈️ Plane Nearby: ${callsign}`,
            message: `${model} • ${direction} • ${distanceM}m away`,
            url: `https://plane-alert.surge.sh/?icao=${icao}&follow=1`,
            url_title: 'View on Map',
            icon: `https://plane-alert.surge.sh/assets/favicon/android-chrome-192x192.png?v=${Date.now()}`,
            registration: plane.r,
            hex: plane.hex,
          });

          lastProximityNotified[icao] = now;
        }
      }

      logger.info('Proximity check complete', {
        docId,
        proximityChecked,
        proximityWithin2km,
        proximityNotificationsSent:
          messages.length - (militaryCount + specialCount),
      });
    }

    logger.info('Aircraft filtering results', {
      docId,
      totalAircraft: aircraft.length,
      militaryFlagged: militaryCount + boringCount,
      interestingMilitary: militaryCount,
      boringMilitary: boringCount,
      specialCount,
      recentlyNotifiedCount,
      messagesToSend: messages.length,
    });

    if (!messages.length) {
      await device.set(
        { lastNotified, lastProximityNotified },
        { merge: true },
      );
      return;
    }

    // Send via Pushover API using service
    await sendPushoverNotifications(
      data.pushoverUserKey,
      pushoverTargetDeviceName,
      messages,
      docId,
    );

    await device.set(
      {
        lastNotified,
        lastProximityNotified,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error: any) {
    logger.error('notifyForDevice exception', {
      docId,
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}

export function createNotificationProcessorFunction(
  db: admin.firestore.Firestore,
) {
  return onSchedule(
    {
      schedule: '* * * * *', // Every minute (cron format)
      timeZone: 'Etc/UTC',
    },
    async () => {
      const broadcastAllDevices =
        String(
          process.env.PUSHOVER_BROADCAST_ALL_DEVICES || '',
        ).toLowerCase() === 'true';

      const snapshot = await db.collection(DEVICE_COLLECTION).get();
      if (snapshot.empty) {
        logger.info('No registered devices.');
        return;
      }

      if (!broadcastAllDevices) {
        const tasks = snapshot.docs.map((doc: any) =>
          notifyForDevice(
            db,
            doc.ref,
            doc.data() as DeviceRegistration,
            doc.id,
          ).catch((error) =>
            logger.error('notifyForDevice failed', {
              docId: doc.id,
              error,
            }),
          ),
        );
        await Promise.all(tasks);
        return;
      }

      // Broadcast mode: process one (latest) config per Pushover user key,
      // and send notifications without targeting a specific device.
      const bestDocByUserKey = new Map<
        string,
        {
          ref: any;
          id: string;
          data: DeviceRegistration;
          updatedAtMs: number;
        }
      >();

      for (const doc of snapshot.docs as any[]) {
        const data = doc.data() as DeviceRegistration;
        const userKey = data?.pushoverUserKey;
        if (!userKey) continue;

        const updatedAtMs = Math.max(
          getTimestampMillis((data as any).updatedAt),
          getTimestampMillis((data as any).createdAt),
        );

        const existing = bestDocByUserKey.get(userKey);
        if (!existing || updatedAtMs > existing.updatedAtMs) {
          bestDocByUserKey.set(userKey, {
            ref: doc.ref,
            id: doc.id,
            data,
            updatedAtMs,
          });
        }
      }

      logger.info('Broadcast mode: processing users', {
        userCount: bestDocByUserKey.size,
      });

      const tasks = Array.from(bestDocByUserKey.values()).map((entry) =>
        notifyForDevice(db, entry.ref, entry.data, entry.id).catch((error) =>
          logger.error('notifyForUser failed', {
            docId: entry.id,
            userKey: entry.data.pushoverUserKey?.slice(0, 8),
            error,
          }),
        ),
      );

      await Promise.all(tasks);
    },
  );
}
