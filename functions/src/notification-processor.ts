import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import * as countries from 'i18n-iso-countries';
import type { AdsBPlane, AircraftDbEntry, AircraftDbMetadata } from './shared';
import {
  normalizeCallsign,
  getAircraftCountry,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  formatDistance,
  formatNotificationBody,
  getCountryFlagEmoji,
  createAircraftLookupMap,
  looksMilitary,
} from './shared';
import type { DeviceRegistration, Location } from './types';
import {
  DEVICE_COLLECTION,
  COOLDOWN_COLLECTION,
  MAX_NOTIFICATIONS_PER_DEVICE,
  RECENT_NOTIFICATION_TTL_MS,
  ORIGIN_HEADER,
} from './constants';
import {
  clampRadius,
  inferDeviceName,
  sanitizeDeviceName,
  pruneOldNotifications,
  isSpecialAircraft,
} from './utils';

// Import user aircraft database
import userAircraftDb from './data/user-aircraft-db.json';

// Create a lookup map for user aircraft database using shared utility
const userAircraftLookup = createAircraftLookupMap(
  userAircraftDb as Array<AircraftDbEntry | AircraftDbMetadata>
);

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

async function fetchAircraft(
  location: Location,
  radiusKm: number
): Promise<AdsBPlane[]> {
  const radiusNm = radiusKm / 1.852;
  const url = `https://api.adsb.one/v2/point/${location.lat}/${
    location.lon
  }/${radiusNm.toFixed(2)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': ORIGIN_HEADER,
      Accept: 'application/json',
    },
    timeout: 5000,
  } as any);

  if (!response.ok) {
    logger.warn('ADS-B API error', response.status, response.statusText);
    return [];
  }

  const payload = (await response.json()) as { ac?: AdsBPlane[] };
  return payload.ac ?? [];
}

/**
 * Fetch aircraft image from Google Custom Search API
 */
async function fetchAircraftImage(
  model: string,
  operator?: string
): Promise<string | null> {
  const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
  const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    logger.warn('Google Search API credentials not configured');
    return null;
  }

  try {
    // Match frontend search query format (no quotes for better results)
    let searchQuery = `${model} aircraft airplane photo`;
    if (operator) {
      const operatorShort = operator.split(' ')[0];
      searchQuery += ` ${operatorShort}`;
    }
    searchQuery +=
      ' site:planespotters.net OR site:airliners.net OR site:jetphotos.com';
    searchQuery +=
      ' -cartoon -drawing -model -toy -lego -illustration -diagram -youtube -thumbnail';

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('cx', GOOGLE_SEARCH_ENGINE_ID);
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '1');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('safe', 'active');

    const response = await fetch(url.toString(), { timeout: 3000 } as any);

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();

    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return item.link || null;
    }

    return null;
  } catch (error: any) {
    logger.warn('Failed to fetch aircraft image', {
      model,
      error: error?.message,
    });
    return null;
  }
}

/**
 * Download image and convert to Base64
 */
async function downloadAndEncodeImage(
  imageUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      timeout: 3000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PlaneAlert/1.0; +https://plane-alert.surge.sh)',
      },
    } as any);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > 5 * 1024 * 1024) {
      logger.warn('Image too large', {
        url: imageUrl,
        size: buffer.byteLength,
      });
      return null;
    }

    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error: any) {
    logger.warn('Failed to download image', {
      url: imageUrl,
      error: error?.message,
    });
    return null;
  }
}

/**
 * Get operator from callsign
 */
function getOperatorFromCallsign(callsign: string): string | null {
  if (!callsign) {
    return null;
  }

  const operatorMap: Record<string, string> = {
    GAF: 'Luftwaffe',
    SHADO: 'Luftwaffe',
    HUKR: 'Royal Air Force',
    RRR: 'Royal Air Force',
    ASCOT: 'Royal Air Force',
    TARTN: 'Royal Air Force',
    RCH: 'US Air Force',
    REACH: 'US Air Force',
    CNV: 'US Air Force',
    CONVOY: 'US Air Force',
    EVAC: 'US Air Force',
    SPAR: 'US Air Force',
    BOXER: 'US Air Force',
    SENTRY: 'US Air Force',
    DUKE: 'US Army',
    ARMY: 'US Army',
    MARINE: 'US Marine Corps',
    NAVY: 'US Navy',
    COAST: 'US Coast Guard',
    FF: 'French Air Force',
    CTM: 'French Air Force',
    FAF: 'French Air Force',
    EIDER: 'Royal Canadian Air Force',
    CFC: 'Royal Canadian Air Force',
    IAM: 'Italian Air Force',
    MM: 'Italian Air Force',
    NAF: 'Norwegian Armed Forces',
    RSAF: 'Republic of Singapore Air Force',
  };

  const normalized = callsign.trim().toUpperCase();

  if (operatorMap[normalized]) {
    return operatorMap[normalized];
  }

  const sortedPrefixes = Object.keys(operatorMap).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sortedPrefixes) {
    if (normalized.startsWith(prefix)) {
      return operatorMap[prefix];
    }
  }

  return null;
}

/**
 * Build notification body using shared formatter
 */
function buildNotificationBody(
  plane: AdsBPlane,
  distance: { value: number; unit: string },
  direction: string,
  distanceUnit: 'km' | 'miles'
): string {
  const callsign =
    normalizeCallsign(plane.flight || plane.callsign) ||
    plane.hex.toUpperCase();

  const countryResult = getAircraftCountry(plane.r, plane.hex, undefined, true);

  const countryCode =
    countryResult.countryCode !== 'Unknown' ? countryResult.countryCode : null;
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

  const operator = getOperatorFromCallsign(callsign);

  let speed: number | undefined;
  let speedUnit: 'mph' | 'km/h';
  if (plane.gs && plane.gs > 0) {
    if (distanceUnit === 'miles') {
      speed = Math.round(plane.gs * 1.15078);
      speedUnit = 'mph';
    } else {
      speed = Math.round(plane.gs * 1.852);
      speedUnit = 'km/h';
    }
  } else {
    speedUnit = distanceUnit === 'miles' ? 'mph' : 'km/h';
  }

  let altitude: number | undefined;
  let altitudeUnit: 'ft' | 'm';
  const altitudeFeet =
    typeof plane.alt_baro === 'number'
      ? plane.alt_baro
      : typeof plane.alt_geom === 'number'
      ? plane.alt_geom
      : null;

  if (altitudeFeet !== null && altitudeFeet > 0) {
    if (distanceUnit === 'miles') {
      altitude = altitudeFeet;
      altitudeUnit = 'ft';
    } else {
      altitude = Math.round(altitudeFeet * 0.3048);
      altitudeUnit = 'm';
    }
  } else {
    altitudeUnit = distanceUnit === 'miles' ? 'ft' : 'm';
  }

  return formatNotificationBody({
    callsign,
    icao: plane.hex,
    direction,
    flagEmoji,
    operator: operator || undefined,
    speed,
    speedUnit,
    altitude,
    altitudeUnit,
    verticalRate: plane.baro_rate || undefined,
  });
}

/**
 * Check if notification should be sent and atomically mark as notified if allowed
 */
async function checkAndMarkNotified(
  db: admin.firestore.Firestore,
  userKey: string,
  icao: string,
  cooldownMs: number
): Promise<boolean> {
  const cooldownId = `${userKey}__${icao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const now = Date.now();

      if (doc.exists) {
        const data = doc.data();
        const lastSent = data?.lastSent || 0;

        if (now - lastSent < cooldownMs) {
          logger.info('Aircraft in cooldown, skipping', {
            userKey: userKey.slice(0, 8),
            icao,
            timeSinceLastMs: now - lastSent,
            cooldownMs,
          });
          return false;
        }
      }

      logger.info('Claiming notification for aircraft', {
        userKey: userKey.slice(0, 8),
        icao,
        docExists: doc.exists,
      });

      transaction.set(
        cooldownRef,
        {
          userKey,
          icao,
          lastSent: now,
        },
        { merge: true }
      );

      return true;
    });

    logger.info('Transaction result', {
      userKey: userKey.slice(0, 8),
      icao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error: any) {
    logger.error('checkAndMarkNotified transaction failed', {
      userKey: userKey.slice(0, 8),
      icao,
      error,
    });
    return false;
  }
}

async function notifyForDevice(
  db: admin.firestore.Firestore,
  device: any,
  data: DeviceRegistration,
  docId: string
): Promise<void> {
  try {
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
        { merge: true }
      );
      data.deviceName = inferredDeviceName;
      data.deviceSlug = slug;
    }

    logger.info('Processing device', {
      docId,
      userKey: data.pushoverUserKey.slice(0, 8),
      deviceName: data.deviceName,
      radiusKm: data.radiusKm,
      notifyProximity: data.notifyProximity,
      ignoredTypesCount: data.ignoredTypes?.length || 0,
    });

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

    const lastNotified = pruneOldNotifications(data.lastNotified ?? {});
    const messages: Array<Record<string, any>> = [];
    const now = Date.now();

    const specialIcaos = (data.specialIcaos ?? []).map((icao) =>
      icao.toUpperCase()
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

      const userDbEntry = userAircraftLookup.get(icao);
      const isFlaggedMilitary =
        userDbEntry?.mil === true || plane.mil === true || plane.dbFlags === 1;

      const isMilitary =
        userDbEntry !== undefined
          ? userDbEntry.mil === true
          : looksMilitary(plane);

      if (!isMilitary && !isSpecialPlane) {
        if (plane.mil === true || plane.dbFlags === 1) {
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
        }
        continue;
      }

      const aircraftType = (plane.t || plane.desc || '').toUpperCase();
      const ignoredTypes = data.ignoredTypes || [];
      const isIgnored = ignoredTypes.some((ignoredType) => {
        const upperIgnored = ignoredType.toUpperCase();
        return (
          aircraftType.includes(upperIgnored) ||
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
        plane.lon
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
        icao,
        RECENT_NOTIFICATION_TTL_MS
      );

      if (!shouldNotify) {
        recentlyNotifiedCount++;
        continue;
      }

      const bearing = computeBearing(
        deviceLocation.lat,
        deviceLocation.lon,
        plane.lat,
        plane.lon
      );
      const direction = bearingToCardinal(bearing);
      const distance = formatDistance(
        distanceKm,
        data.distanceUnit === 'miles' ? 'miles' : 'km'
      );
      const body = buildNotificationBody(
        plane,
        distance,
        direction,
        data.distanceUnit === 'miles' ? 'miles' : 'km'
      );

      const countryResult = getAircraftCountry(
        plane.r,
        plane.hex,
        undefined,
        true
      );
      const countryName =
        countryResult.countryCode !== 'Unknown'
          ? countries.getName(countryResult.countryCode, 'en')
          : null;

      const icaoUpper = icao.toUpperCase();

      // Look up enriched model from user aircraft database
      const dbRecord = userAircraftLookup.get(icaoUpper);
      let aircraftName = dbRecord?.model || plane.desc || plane.t || '';

      if (!aircraftName) {
        if (countryName) {
          aircraftName = `${countryName} Military`;
        } else {
          aircraftName = 'Military Aircraft';
        }
      }
      const iconPath = isSpecialAircraft(icaoUpper)
        ? 'favicon/special'
        : 'favicon/military';
      const iconUrl = `https://plane-alert.surge.sh/assets/${iconPath}/android-chrome-192x192.png?v=${Date.now()}`;

      let title = aircraftName;
      if (
        aircraftName.toUpperCase().includes('A400') ||
        aircraftName.toUpperCase().includes('A-400')
      ) {
        title = '🦜 ' + title;
      } else if (
        aircraftName.toUpperCase().includes('E-3') ||
        aircraftName.toUpperCase().includes('SENTRY')
      ) {
        title = '🛸 ' + title;
      }

      if (title === '') {
        title = 'Military Plane Alert';
      }

      messages.push({
        title: title,
        message: body,
        url: `https://plane-alert.surge.sh/?icao=${icao}&follow=1`,
        url_title: 'View on Map',
        icon: iconUrl,
        model: plane.t || plane.desc,
        operator: plane.desc,
      });

      lastNotified[icao] = now;

      if (messages.length >= MAX_NOTIFICATIONS_PER_DEVICE) {
        break;
      }
    }

    // Proximity notifications
    const lastProximityNotified = pruneOldNotifications(
      data.lastProximityNotified ?? {}
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
          `proximity_${icao}`,
          PROXIMITY_NOTIFICATION_COOLDOWN_MS
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
          plane.lon
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
          const model = plane.desc || plane.t || 'Aircraft';
          const distanceM = Math.round(distanceKm * 1000);

          const bearing = computeBearing(
            deviceLocation.lat,
            deviceLocation.lon,
            plane.lat,
            plane.lon
          );
          const direction = bearingToCardinal(bearing);

          messages.push({
            title: `✈️ Plane Nearby: ${callsign}`,
            message: `${model} • ${direction} • ${distanceM}m away`,
            url: `https://plane-alert.surge.sh/?icao=${icao}&follow=1`,
            url_title: 'View on Map',
            icon: `https://plane-alert.surge.sh/assets/favicon/android-chrome-192x192.png?v=${Date.now()}`,
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
        { merge: true }
      );
      return;
    }

    // Send via Pushover API
    for (const msg of messages) {
      try {
        logger.info('Sending Pushover notification', {
          docId,
          deviceName: data.deviceName,
          userKey: data.pushoverUserKey.slice(0, 8),
          message: msg.message,
          model: msg.model,
        });

        let attachmentBase64: string | null = null;
        if (msg.model && msg.model.trim()) {
          logger.info('Fetching aircraft image', {
            docId,
            model: msg.model,
          });

          const imageUrl = await fetchAircraftImage(msg.model, msg.operator);
          if (imageUrl) {
            logger.info('Found image URL, downloading', {
              docId,
              url: imageUrl.substring(0, 100),
            });
            attachmentBase64 = await downloadAndEncodeImage(imageUrl);
            if (attachmentBase64) {
              logger.info('Image encoded successfully', {
                docId,
                size: attachmentBase64.length,
              });
            }
          }
        }

        const params: Record<string, string> = {
          token: PUSHOVER_API_TOKEN || '',
          user: data.pushoverUserKey,
          device: data.deviceName || '',
          title: msg.title,
          message: msg.message,
          url: msg.url || '',
          url_title: msg.url_title || '',
          priority: '1',
          sound: 'none',
          icon: msg.icon || '',
        };

        if (attachmentBase64) {
          params.attachment_base64 = attachmentBase64;
          params.attachment_type = 'image/jpeg';
        }

        const response = await fetch(
          'https://api.pushover.net/1/messages.json',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params),
          } as any
        );

        const result: any = await response.json();

        if (response.ok && result.status === 1) {
          logger.info('Sent Pushover notification', {
            userKey: data.pushoverUserKey.slice(0, 8),
            message: msg.message,
            withImage: !!attachmentBase64,
          });
        } else {
          logger.error('Pushover API error', {
            userKey: data.pushoverUserKey.slice(0, 8),
            error: result,
          });
        }
      } catch (error: any) {
        logger.error('Failed to send Pushover notification', {
          docId,
          userKey: data.pushoverUserKey.slice(0, 8),
          error: error?.message,
        });
      }
    }

    await device.set(
      {
        lastNotified,
        lastProximityNotified,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
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
  db: admin.firestore.Firestore
) {
  return onSchedule(
    {
      schedule: 'every 3 minutes',
      timeZone: 'Etc/UTC',
    },
    async () => {
      const snapshot = await db.collection(DEVICE_COLLECTION).get();
      if (snapshot.empty) {
        logger.info('No registered devices.');
        return;
      }

      const tasks = snapshot.docs.map((doc: any) =>
        notifyForDevice(
          db,
          doc.ref,
          doc.data() as DeviceRegistration,
          doc.id
        ).catch((error) =>
          logger.error('notifyForDevice failed', {
            docId: doc.id,
            error,
          })
        )
      );

      await Promise.all(tasks);
    }
  );
}
