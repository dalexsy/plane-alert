// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

// Import shared library functions
import {
  type AdsBPlane,
  looksMilitary,
  normalizeCallsign,
  getAircraftCountry,
  haversineDistanceKm,
  computeBearing,
  bearingToCardinal,
  formatDistance,
} from './shared';

admin.initializeApp();

const db = admin.firestore();
const DEVICE_COLLECTION = 'deviceTokens';
const DEFAULT_RADIUS_KM = 100;
const MIN_RADIUS_KM = 10;
const MAX_RADIUS_KM = 200;
const MAX_NOTIFICATIONS_PER_DEVICE = 2;
const RECENT_NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Special aircraft ICAO codes (Air Force One, etc.)
const SPECIAL_ICAOS = ['a13435', 'adfdf8', 'adfdf9']; // Add more as needed

function isSpecialAircraft(icao: string): boolean {
  return SPECIAL_ICAOS.includes(icao.toLowerCase());
}
const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

interface HomeLocation {
  lat: number;
  lon: number;
  address?: string;
}

interface DeviceRegistration {
  pushoverUserKey: string;
  platform?: string;
  distanceUnit?: 'km' | 'miles';
  radiusKm?: number;
  timezone?: string;
  home?: HomeLocation;
  specialIcaos?: string[]; // Array of ICAO codes user wants to be notified about
  lastNotified?: Record<string, number>;
  createdAt?: any;
  updatedAt?: any;
}

const ORIGIN_HEADER =
  'PlaneAlertCloudFunction/1.0 (+functions.https://plane-alert.surge.sh)';

function clampRadius(radiusKm?: number | null): number {
  if (typeof radiusKm !== 'number' || Number.isNaN(radiusKm)) {
    return DEFAULT_RADIUS_KM;
  }
  return Math.min(Math.max(radiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM);
}

function pruneOldNotifications(
  map: Record<string, number>
): Record<string, number> {
  const cutoff = Date.now() - RECENT_NOTIFICATION_TTL_MS;
  const next: Record<string, number> = {};
  for (const [icao, timestamp] of Object.entries(map)) {
    if (timestamp >= cutoff) {
      next[icao] = timestamp;
    }
  }
  return next;
}

async function fetchAircraft(
  home: HomeLocation,
  radiusKm: number
): Promise<AdsBPlane[]> {
  const radiusNm = radiusKm / 1.852;
  const url = `functions.https://api.adsb.one/v2/point/${home.lat}/${
    home.lon
  }/${radiusNm.toFixed(2)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': ORIGIN_HEADER,
      Accept: 'application/json',
    },
    timeout: 5000,
  } as any);

  if (!response.ok) {
    logger.warn(
      'ADS-B API error',
      response.status,
      response.statusText
    );
    return [];
  }

  const payload = (await response.json()) as { ac?: AdsBPlane[] };
  return payload.ac ?? [];
}

/**
 * Get directional arrow for cardinal direction (matches frontend)
 */
function getArrowForDirection(cardinal: string): string {
  const arrows: { [key: string]: string } = {
    N: '↑',
    NNE: '↗',
    NE: '↗',
    ENE: '↗',
    E: '→',
    ESE: '↘',
    SE: '↘',
    SSE: '↘',
    S: '↓',
    SSW: '↙',
    SW: '↙',
    WSW: '↙',
    W: '←',
    WNW: '↖',
    NW: '↖',
    NNW: '↖',
  };
  return arrows[cardinal] || '↑';
}

/**
 * Convert country code to flag emoji
 */
function getCountryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown' || countryCode.length !== 2) {
    return '🏳️'; // White flag for unknown
  }

  // Convert country code to regional indicator symbols
  // A = U+1F1E6, so offset each letter by 0x1F1E6 - 0x41
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

/**
 * Get operator from callsign using same logic as frontend
 */
function getOperatorFromCallsign(callsign: string): string | null {
  if (!callsign) {
    return null;
  }

  // Operator callsign mappings (matches operator-call-signs.json from frontend)
  // This is a simplified version - in production you'd load the full JSON
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

  // Try exact match first
  if (operatorMap[normalized]) {
    return operatorMap[normalized];
  }

  // Try prefix match (sorted by length, longest first)
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
 * Build notification body matching frontend format
 * Format: 🇩🇪 GAF013 - Luftwaffe (instead of "GAF013 from Germany")
 */
function buildNotificationBody(
  plane: AdsBPlane,
  distance: { value: number; unit: string },
  direction: string
): string {
  const callsign =
    normalizeCallsign(plane.flight || plane.callsign) ||
    plane.hex.toUpperCase();

  // Use shared library to get country
  const countryResult = getAircraftCountry(
    plane.r, // registration
    plane.hex, // ICAO hex
    undefined, // API country (not provided by ADS-B)
    true // isMilitary (we only call this for military aircraft)
  );

  // Get arrow for direction
  const arrow = getArrowForDirection(direction);

  // Get flag emoji
  const countryCode =
    countryResult.countryCode !== 'Unknown' ? countryResult.countryCode : null;
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

  // Get operator from callsign
  const operator = getOperatorFromCallsign(callsign);

  // Format: W ← 10km - 🇩🇪 GAF013 - Luftwaffe
  // Example: "W ← 45.2 km - 🇩🇪 GAF013 - Luftwaffe"
  const operatorPart = operator ? ` - ${operator}` : '';
  return `${direction} ${arrow} ${distance.value}${distance.unit} - ${flagEmoji} ${callsign}${operatorPart}`;
}

async function notifyForDevice(
  device: any,
  data: DeviceRegistration,
  docId: string
): Promise<void> {
  if (!data.pushoverUserKey || !data.home) {
    return;
  }

  logger.info('Processing device', {
    docId,
    userKey: data.pushoverUserKey.slice(0, 8),
    radiusKm: data.radiusKm,
  });

  const radiusKm = clampRadius(data.radiusKm);
  const aircraft = await fetchAircraft(data.home, radiusKm);

  logger.info('Fetched aircraft', {
    docId,
    totalAircraft: aircraft.length,
  });

  if (!aircraft.length) {
    return;
  }

  const lastNotified = pruneOldNotifications(data.lastNotified ?? {});
  const messages: Array<Record<string, any>> = [];
  const now = Date.now();

  // Normalize user's special ICAOs to uppercase for comparison
  const specialIcaos = (data.specialIcaos ?? []).map((icao) =>
    icao.toUpperCase()
  );

  let militaryCount = 0;
  let specialCount = 0;
  let boringCount = 0;
  let recentlyNotifiedCount = 0;

  // Debug: Log a few sample aircraft to see what data we're getting
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

    // Check if this is a special plane (user's watchlist)
    const isSpecialPlane = specialIcaos.includes(icao);

    // Only notify for military planes or special planes
    const isMilitary = looksMilitary(plane);

    if (!isMilitary && !isSpecialPlane) {
      if (plane.mil === true || plane.dbFlags === 1) {
        boringCount++;
        // Log boring aircraft that have military flags but are filtered
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
      data.home.lat,
      data.home.lon,
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

    if (
      lastNotified[icao] &&
      now - lastNotified[icao] < RECENT_NOTIFICATION_TTL_MS
    ) {
      recentlyNotifiedCount++;
      continue;
    }

    const bearing = computeBearing(
      data.home.lat,
      data.home.lon,
      plane.lat,
      plane.lon
    );
    const direction = bearingToCardinal(bearing);
    const distance = formatDistance(
      distanceKm,
      data.distanceUnit === 'miles' ? 'miles' : 'km'
    );
    const body = buildNotificationBody(plane, distance, direction);

    // Build title with aircraft description (full name) if available
    // Fallback order: desc -> type code (t) -> callsign -> registration -> generic
    // Note: plane.type is the ADS-B message type (like "adsb_icao"), not aircraft type
    let aircraftName = plane.desc || plane.t || '';

    if (!aircraftName) {
      // If no type info, use callsign or registration
      const callsign = normalizeCallsign(plane.flight || plane.callsign);
      const registration = plane.r;
      aircraftName = callsign || registration || 'Military Aircraft';
    }

    // Use special icon for special aircraft (Air Force One, etc.), otherwise military icon
    const icaoUpper = icao.toUpperCase();
    const iconPath = isSpecialAircraft(icaoUpper) ? 'favicon/special' : 'favicon/military';
    const iconUrl = `functions.https://plane-alert.surge.sh/assets/${iconPath}/android-chrome-192x192.png?v=${Date.now()}`;

    // Custom emojis for specific aircraft types
    let title = aircraftName;
    if (
      aircraftName.toUpperCase().includes('A400') ||
      aircraftName.toUpperCase().includes('A-400')
    ) {
      title = '🦜 ' + title; // Parrot for A400M
    } else if (
      aircraftName.toUpperCase().includes('E-3') ||
      aircraftName.toUpperCase().includes('SENTRY')
    ) {
      title = '🛸 ' + title; // UFO for Sentry
    }

    if (title === '') {
      title = 'Military Plane Alert';
    }

    messages.push({
      title: title,
      message: body,
      url: `functions.https://plane-alert.surge.sh/?icao=${icao}&follow=1`,
      url_title: 'View on Map',
      icon: iconUrl,
    });

    lastNotified[icao] = now;

    if (messages.length >= MAX_NOTIFICATIONS_PER_DEVICE) {
      break;
    }
  }

  logger.info('Aircraft filtering results', {
    docId,
    totalAircraft: aircraft.length,
    militaryCount,
    specialCount,
    boringCount,
    recentlyNotifiedCount,
    messagesToSend: messages.length,
  });

  if (!messages.length) {
    await device.set({ lastNotified }, { merge: true });
    return;
  }

  // Send via Pushover API
  for (const msg of messages) {
    try {
      logger.info('Sending Pushover notification', {
        docId,
        userKey: data.pushoverUserKey.slice(0, 8),
        message: msg.message,
      });

      const response = await fetch('functions.https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: PUSHOVER_API_TOKEN || '',
          user: data.pushoverUserKey,
          title: msg.title,
          message: msg.message,
          url: msg.url || '',
          url_title: msg.url_title || '',
          priority: '1', // High priority
          sound: 'intermission',
          icon: msg.icon || '',
        }),
      } as any);

      const result: any = await response.json();

      if (response.ok && result.status === 1) {
        logger.info('Sent Pushover notification', {
          userKey: data.pushoverUserKey.slice(0, 8),
          message: msg.message,
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export const registerDevice = onRequest(
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const {
        pushoverUserKey,
        platform,
        distanceUnit,
        radiusKm,
        timezone,
        home,
        specialIcaos,
      } = req.body as {
        pushoverUserKey?: string;
        platform?: string;
        distanceUnit?: 'km' | 'miles';
        radiusKm?: number;
        timezone?: string;
        home?: HomeLocation;
        specialIcaos?: string[];
      };

      if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
        res.status(400).json({ error: 'pushoverUserKey is required' });
        return;
      }

      if (
        !home ||
        typeof home.lat !== 'number' ||
        typeof home.lon !== 'number'
      ) {
        res
          .status(400)
          .json({ error: 'home location with lat/lon is required' });
        return;
      }

      const doc: DeviceRegistration = {
        pushoverUserKey,
        platform,
        distanceUnit: distanceUnit === 'miles' ? 'miles' : 'km',
        radiusKm: clampRadius(radiusKm),
        timezone,
        home,
        specialIcaos: Array.isArray(specialIcaos) ? specialIcaos : undefined,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      await db
        .collection(DEVICE_COLLECTION)
        .doc(pushoverUserKey)
        .set(
          {
            ...doc,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('registerDevice failed', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

export const debugListTokens = onRequest(
  async (req: any, res: any) => {
    const secret = process.env.DEBUG_TOKEN_SECRET;
    if (!secret || req.query.secret !== secret) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const snapshot = await db.collection(DEVICE_COLLECTION).get();
    const tokens = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      data: doc.data(),
    }));

    res.json({ count: tokens.length, tokens });
  }
);

export const debugSendToken = onRequest(
  async (req: any, res: any) => {
    const secret = process.env.DEBUG_TOKEN_SECRET;
    if (!secret || req.query.secret !== secret) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const userKey = req.query.userKey as string | undefined;
    if (!userKey) {
      res.status(400).json({ error: 'userKey query param required' });
      return;
    }

    const snapshot = await db.collection(DEVICE_COLLECTION).doc(userKey).get();
    if (!snapshot.exists) {
      res.status(404).json({ error: 'user not found' });
      return;
    }

    try {
      const response = await fetch('functions.https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: PUSHOVER_API_TOKEN || '',
          user: userKey,
          title: 'Plane Alert Debug',
          message: 'Test notification from debug endpoint',
          priority: '1',
        }),
      } as any);

      const result: any = await response.json();

      if (response.ok && result.status === 1) {
        res.json({ success: true, request: result.request });
      } else {
        res.status(500).json({ error: result });
      }
    } catch (error: any) {
      logger.error('debugSendToken failed', {
        userKey,
        error,
      });
      res.status(500).json({ error: error?.message ?? 'send failed' });
    }
  }
);

export const processPlanes = onSchedule(
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
      notifyForDevice(doc.ref, doc.data() as DeviceRegistration, doc.id).catch(
        (error) =>
          logger.error('notifyForDevice failed', {
            docId: doc.id,
            error,
          })
      )
    );

    await Promise.all(tasks);
  }
);




