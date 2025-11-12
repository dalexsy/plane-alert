// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import * as countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

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
  formatNotificationBody,
  getCountryFlagEmoji,
  getArrowForDirection,
  createAircraftLookupMap,
  isMilitaryAircraft,
  type AircraftDbEntry,
  type AircraftDbMetadata,
} from './shared';

// Import user aircraft database
import userAircraftDb from './data/user-aircraft-db.json';

// Register English locale for country names
countries.registerLocale(en);

// Create a lookup map for user aircraft database using shared utility
const userAircraftLookup = createAircraftLookupMap(
  userAircraftDb as Array<AircraftDbEntry | AircraftDbMetadata>
);

admin.initializeApp();

const db = admin.firestore();
const DEVICE_COLLECTION = 'deviceTokens';
const COOLDOWN_COLLECTION = 'notification-cooldowns';
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
  ignoredTypes?: string[]; // Array of aircraft type codes to ignore (e.g., ['C130', 'A400'])
  notifyProximity?: boolean; // Notify for ANY plane within 2km
  lastNotified?: Record<string, number>;
  lastProximityNotified?: Record<string, number>; // Track proximity notifications separately
  deviceName?: string;
  deviceSlug?: string;
  createdAt?: any;
  updatedAt?: any;
}

const ORIGIN_HEADER =
  'PlaneAlertCloudFunction/1.0 (+https://plane-alert.surge.sh)';

function sanitizeDeviceName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'default';
  }
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'default';
}

function getDeviceDocId(pushoverUserKey: string, deviceName: string): string {
  const slug = sanitizeDeviceName(deviceName);
  return `${pushoverUserKey}__${slug}`;
}

function inferDeviceName(docId: string, data: DeviceRegistration): string {
  if (data.deviceName && data.deviceName.trim().length > 0) {
    return data.deviceName.trim();
  }
  if (data.deviceSlug && data.deviceSlug.trim().length > 0) {
    return data.deviceSlug.trim();
  }
  const splitIndex = docId.indexOf('__');
  if (splitIndex !== -1 && splitIndex + 2 < docId.length) {
    const slug = docId.slice(splitIndex + 2);
    if (slug) {
      return slug.replace(/-/g, ' ');
    }
  }
  return 'default';
}

async function validatePushoverUserKey(
  pushoverUserKey: string
): Promise<{ devices: string[]; valid: boolean }> {
  if (!PUSHOVER_API_TOKEN) {
    return { devices: [], valid: false };
  }

  try {
    const params = new URLSearchParams({
      token: PUSHOVER_API_TOKEN,
      user: pushoverUserKey,
    });

    const response = await fetch(
      'https://api.pushover.net/1/users/validate.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        timeout: 4000,
      } as any
    );

    if (!response.ok) {
      logger.warn('Pushover validate call failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return { devices: [], valid: false };
    }

    const result: any = await response.json();
    if (result.status !== 1) {
      return { devices: [], valid: false };
    }

    const devices: string[] = Array.isArray(result.devices)
      ? result.devices.map((device: any) => String(device)).filter(Boolean)
      : [];

    return { devices, valid: true };
  } catch (error: any) {
    logger.warn('Failed to validate Pushover key', {
      error: error?.message,
    });
    return { devices: [], valid: false };
  }
}

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

/**
 * Check if notification should be sent and atomically mark as notified if allowed.
 * Uses a Firestore transaction to prevent race conditions between multiple devices.
 * Returns true if notification should be sent, false if still in cooldown.
 */
async function checkAndMarkNotified(
  userKey: string,
  icao: string,
  cooldownMs: number
): Promise<boolean> {
  const cooldownId = `${userKey}__${icao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);

  try {
    // Use transaction to atomically check and update
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const now = Date.now();

      if (doc.exists) {
        const data = doc.data();
        const lastSent = data?.lastSent || 0;

        // Check if still in cooldown
        if (now - lastSent < cooldownMs) {
          logger.info('Aircraft in cooldown, skipping', {
            userKey: userKey.slice(0, 8),
            icao,
            timeSinceLastMs: now - lastSent,
            cooldownMs,
          });
          return false; // Don't send, still in cooldown
        }
      }

      // Either no cooldown exists or cooldown expired - mark as notified
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

      return true; // Send notification
    });

    logger.info('Transaction result', {
      userKey: userKey.slice(0, 8),
      icao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error) {
    logger.error('Error in checkAndMarkNotified transaction', {
      userKey: userKey.slice(0, 8),
      icao,
      error,
    });
    return false; // If error, don't send to avoid duplicates
  }
}

async function fetchAircraft(
  home: HomeLocation,
  radiusKm: number
): Promise<AdsBPlane[]> {
  const radiusNm = radiusKm / 1.852;
  const url = `https://api.adsb.one/v2/point/${home.lat}/${
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
    logger.warn('ADS-B API error', response.status, response.statusText);
    return [];
  }

  const payload = (await response.json()) as { ac?: AdsBPlane[] };
  return payload.ac ?? [];
}

/**
 * Fetch aircraft image from Google Custom Search API
 * @param model - Aircraft model (e.g., "B77W", "A400M")
 * @param operator - Optional operator name for better search results
 * @returns Image URL or null if not found
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
    // Wrap model in quotes to prevent single-letter matches (e.g., "E" matching Emirates)
    let searchQuery = `"${model}" aircraft airplane photo`;
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
 * @param imageUrl - URL of the image to download
 * @returns Base64-encoded image string or null
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

    // Check size limit (5MB)
    if (buffer.byteLength > 5 * 1024 * 1024) {
      logger.warn('Image too large', {
        url: imageUrl,
        size: buffer.byteLength,
      });
      return null;
    }

    // Convert to Base64
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
 * Get directional arrow for cardinal direction (matches frontend)
 */
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
 * Build notification body matching frontend tooltip format
 * Format: W ← • 🇩🇪 GAF013 • Luftwaffe • 450 km/h • 3,500 ft ↗
 */
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

  // Use shared library to get country
  const countryResult = getAircraftCountry(
    plane.r, // registration
    plane.hex, // ICAO hex
    undefined, // API country (not provided by ADS-B)
    true // isMilitary (we only call this for military aircraft)
  );

  // Get flag emoji
  const countryCode =
    countryResult.countryCode !== 'Unknown' ? countryResult.countryCode : null;
  const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : '🏳️';

  // Get operator from callsign
  const operator = getOperatorFromCallsign(callsign);

  // Format speed (gs is in knots, convert to km/h or mph)
  let speed: number | undefined;
  let speedUnit: 'mph' | 'km/h';
  if (plane.gs && plane.gs > 0) {
    if (distanceUnit === 'miles') {
      speed = Math.round(plane.gs * 1.15078); // knots to mph
      speedUnit = 'mph';
    } else {
      speed = Math.round(plane.gs * 1.852); // knots to km/h
      speedUnit = 'km/h';
    }
  } else {
    speedUnit = distanceUnit === 'miles' ? 'mph' : 'km/h';
  }

  // Format altitude
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
      // Imperial: feet
      altitude = altitudeFeet;
      altitudeUnit = 'ft';
    } else {
      // Metric: meters
      altitude = Math.round(altitudeFeet * 0.3048);
      altitudeUnit = 'm';
    }
  } else {
    altitudeUnit = distanceUnit === 'miles' ? 'ft' : 'm';
  }

  // Use shared formatter - single source of truth!
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

async function notifyForDevice(
  device: any,
  data: DeviceRegistration,
  docId: string
): Promise<void> {
  try {
    if (!data.pushoverUserKey || !data.home) {
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
    const aircraft = await fetchAircraft(data.home, radiusKm);

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

      // Check if aircraft is military using unified logic:
      // 1. Check user database first (highest priority)
      const userDbEntry = userAircraftLookup.get(icao);
      const isFlaggedMilitary =
        userDbEntry?.mil === true || plane.mil === true || plane.dbFlags === 1;

      // 2. Apply boring type filter (uses looksMilitary which checks both flags and types)
      // If in user DB, trust it regardless of type; otherwise use full looksMilitary check
      const isMilitary =
        userDbEntry !== undefined
          ? userDbEntry.mil === true
          : looksMilitary(plane);

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

      // Check if aircraft type is in ignored list
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
        // Don't notify for ignored types (unless it's a special plane)
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

      // Use global cooldown check with atomic transaction (shared across all devices)
      const shouldNotify = await checkAndMarkNotified(
        data.pushoverUserKey,
        icao,
        RECENT_NOTIFICATION_TTL_MS
      );

      if (!shouldNotify) {
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
      const body = buildNotificationBody(
        plane,
        distance,
        direction,
        data.distanceUnit === 'miles' ? 'miles' : 'km'
      );

      // Get country for title fallback
      const countryResult = getAircraftCountry(
        plane.r, // registration
        plane.hex, // ICAO hex
        undefined, // API country (not provided by ADS-B)
        true // isMilitary
      );
      const countryName =
        countryResult.countryCode !== 'Unknown'
          ? countries.getName(countryResult.countryCode, 'en')
          : null;

      // Build title with aircraft description (full name) if available
      // Fallback order: desc -> type code (t) -> country military -> generic
      // Note: plane.type is the ADS-B message type (like "adsb_icao"), not aircraft type
      let aircraftName = plane.desc || plane.t || '';

      if (!aircraftName) {
        // If no model/type, use country military instead of callsign
        // (callsign is already in the body, so no need to repeat it in title)
        if (countryName) {
          aircraftName = `${countryName} Military`;
        } else {
          aircraftName = 'Military Aircraft';
        }
      }

      // Use special icon for special aircraft (Air Force One, etc.), otherwise military icon
      const icaoUpper = icao.toUpperCase();
      const iconPath = isSpecialAircraft(icaoUpper)
        ? 'favicon/special'
        : 'favicon/military';
      const iconUrl = `https://plane-alert.surge.sh/assets/${iconPath}/android-chrome-192x192.png?v=${Date.now()}`;

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
        url: `https://plane-alert.surge.sh/?icao=${icao}&follow=1`,
        url_title: 'View on Map',
        icon: iconUrl,
        model: plane.t || plane.desc, // Include model for image lookup
        operator: plane.desc, // Operator name for better image search
      });

      // Already marked as notified by checkAndMarkNotified above
      lastNotified[icao] = now;

      if (messages.length >= MAX_NOTIFICATIONS_PER_DEVICE) {
        break;
      }
    }

    // Check for proximity notifications (any plane within 3km - very close/overhead)
    const lastProximityNotified = pruneOldNotifications(
      data.lastProximityNotified ?? {}
    );
    const PROXIMITY_THRESHOLD_KM = 3.0;
    const PROXIMITY_NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    if (data.notifyProximity === true) {
      logger.info('Checking proximity alerts', {
        docId,
        homeLocation: `${data.home.lat},${data.home.lon}`,
        aircraftCount: aircraft.length,
        threshold: PROXIMITY_THRESHOLD_KM,
      });

      let proximityChecked = 0;
      let proximityWithin2km = 0;

      for (const plane of aircraft) {
        const icao = plane.hex?.toUpperCase();
        if (!icao) continue;

        // Use atomic transaction to check and mark proximity notification
        const shouldNotify = await checkAndMarkNotified(
          data.pushoverUserKey,
          `proximity_${icao}`, // Use prefix to separate from military alerts
          PROXIMITY_NOTIFICATION_COOLDOWN_MS
        );

        if (!shouldNotify) {
          continue;
        }

        // Check if plane has coordinates
        if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
          continue;
        }

        proximityChecked++;

        const distanceKm = haversineDistanceKm(
          data.home.lat,
          data.home.lon,
          plane.lat,
          plane.lon
        );

        // Check if within 2km
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
            data.home.lat,
            data.home.lon,
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

          // Already marked as notified by checkAndMarkNotified above
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
      militaryFlagged: militaryCount + boringCount, // Total with military flags
      interestingMilitary: militaryCount, // Passed all filters
      boringMilitary: boringCount, // Filtered as boring types
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
          userKey: data.pushoverUserKey.slice(0, 8),
          message: msg.message,
          model: msg.model,
        });

        // Try to fetch aircraft image if model is available
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
          title: msg.title,
          message: msg.message,
          url: msg.url || '',
          url_title: msg.url_title || '',
          priority: '1', // High priority
          sound: 'none', // Disabled sounds by default
          icon: msg.icon || '',
        };

        // Add attachment if available
        if (attachmentBase64) {
          params.attachment_base64 = attachmentBase64;
          params.attachment_type = 'image/jpeg'; // Most aviation photos are JPEG
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

export const registerDevice = onRequest(async (req, res) => {
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
      notifyProximity,
      deviceName,
      ignoredTypes,
    } = req.body as {
      pushoverUserKey?: string;
      platform?: string;
      distanceUnit?: 'km' | 'miles';
      radiusKm?: number;
      timezone?: string;
      home?: HomeLocation;
      specialIcaos?: string[];
      notifyProximity?: boolean;
      deviceName?: string;
      ignoredTypes?: string[];
    };

    if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
      res.status(400).json({ error: 'pushoverUserKey is required' });
      return;
    }

    if (!deviceName || typeof deviceName !== 'string') {
      res.status(400).json({ error: 'deviceName is required' });
      return;
    }

    const normalizedDeviceName = deviceName.trim();
    if (!normalizedDeviceName) {
      res.status(400).json({ error: 'deviceName must not be empty' });
      return;
    }

    if (!home || typeof home.lat !== 'number' || typeof home.lon !== 'number') {
      res.status(400).json({ error: 'home location with lat/lon is required' });
      return;
    }

    const deviceSlug = sanitizeDeviceName(normalizedDeviceName);
    const docId = getDeviceDocId(pushoverUserKey, normalizedDeviceName);
    const deviceRef = db.collection(DEVICE_COLLECTION).doc(docId);
    const existing = await deviceRef.get();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const doc: DeviceRegistration = {
      pushoverUserKey,
      platform,
      distanceUnit: distanceUnit === 'miles' ? 'miles' : 'km',
      radiusKm: clampRadius(radiusKm),
      timezone,
      home,
      specialIcaos: Array.isArray(specialIcaos) ? specialIcaos : [],
      notifyProximity: notifyProximity === true,
      ignoredTypes: Array.isArray(ignoredTypes) ? ignoredTypes : [],
      deviceName: normalizedDeviceName,
      deviceSlug,
      updatedAt: timestamp as any,
    };

    const payload: Record<string, any> = {
      ...doc,
    };

    if (
      !existing.exists ||
      !(existing.data() as DeviceRegistration)?.createdAt
    ) {
      payload.createdAt = timestamp;
    }

    await deviceRef.set(payload, { merge: true });

    res.status(200).json({
      success: true,
      deviceId: deviceRef.id,
      deviceName: normalizedDeviceName,
      deviceSlug,
    });
  } catch (error: any) {
    logger.error('registerDevice failed', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export const checkDevice = onRequest(async (req, res) => {
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
    const { pushoverUserKey } = req.body as { pushoverUserKey?: string };

    if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
      res.status(400).json({ error: 'pushoverUserKey is required' });
      return;
    }

    const collectionRef = db.collection(DEVICE_COLLECTION);
    const prefix = `${pushoverUserKey}__`;
    const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

    const [fieldMatchSnapshot, prefixSnapshot, legacyDoc] = await Promise.all([
      collectionRef.where('pushoverUserKey', '==', pushoverUserKey).get(),
      collectionRef
        .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
        .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
        .get(),
      collectionRef.doc(pushoverUserKey).get(),
    ]);

    const snapshotDocs = new Map<string, FirebaseFirestore.DocumentSnapshot>();

    for (const doc of fieldMatchSnapshot.docs) {
      snapshotDocs.set(doc.id, doc);
    }

    for (const doc of prefixSnapshot.docs) {
      snapshotDocs.set(doc.id, doc);
    }

    if (legacyDoc.exists) {
      snapshotDocs.set(legacyDoc.id, legacyDoc);
    }

    const deviceEntries: Array<{
      deviceId: string;
      deviceName: string;
      platform?: string;
      config: {
        radiusKm?: number;
        distanceUnit?: 'km' | 'miles';
        notifyProximity?: boolean;
        ignoredTypes?: string[];
        home?: HomeLocation;
        createdAt?: any;
        updatedAt?: any;
      };
    }> = [];

    for (const doc of snapshotDocs.values()) {
      const data = doc.data() as DeviceRegistration;
      const deviceName = inferDeviceName(doc.id, data);

      if (!data.deviceName || data.deviceName !== deviceName) {
        await doc.ref.set(
          {
            deviceName,
            deviceSlug: sanitizeDeviceName(deviceName),
          },
          { merge: true }
        );
      }

      deviceEntries.push({
        deviceId: doc.id,
        deviceName,
        platform: data.platform,
        config: {
          radiusKm: data.radiusKm,
          distanceUnit: data.distanceUnit,
          notifyProximity: data.notifyProximity,
          ignoredTypes: data.ignoredTypes,
          home: data.home,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
      });
    }

    const validation = await validatePushoverUserKey(pushoverUserKey);
    const keyValid = validation.valid || deviceEntries.length > 0;

    const availableDevicesSet = new Set<string>();
    for (const name of validation.devices) {
      if (typeof name === 'string' && name.trim().length > 0) {
        availableDevicesSet.add(name.trim());
      }
    }
    for (const entry of deviceEntries) {
      if (entry.deviceName.trim().length > 0) {
        availableDevicesSet.add(entry.deviceName.trim());
      }
    }

    const availableDevices = Array.from(availableDevicesSet).sort((a, b) =>
      a.localeCompare(b)
    );

    res.status(200).json({
      registered: deviceEntries.length > 0,
      keyValid,
      devices: deviceEntries,
      availableDevices,
    });
  } catch (error: any) {
    logger.error('checkDevice failed', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export const listAllDevices = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // List ALL registered devices from Firebase
    const snapshot = await db.collection(DEVICE_COLLECTION).get();

    const devices = snapshot.docs.map((doc) => {
      const data = doc.data() as DeviceRegistration;
      const deviceName = inferDeviceName(doc.id, data);
      if (!data.deviceName || data.deviceName !== deviceName) {
        doc.ref
          .set(
            {
              deviceName,
              deviceSlug: sanitizeDeviceName(deviceName),
            },
            { merge: true }
          )
          .catch((error: any) =>
            logger.warn('Failed to backfill device metadata', {
              docId: doc.id,
              error: error?.message,
            })
          );
      }

      const keySource = data.pushoverUserKey || doc.id;
      const maskedKey =
        keySource.length > 12
          ? `${keySource.substring(0, 8)}...${keySource.substring(
              keySource.length - 4
            )}`
          : keySource;

      const hasLocation =
        data.home &&
        typeof data.home.lat === 'number' &&
        typeof data.home.lon === 'number';

      let location = 'Unknown';
      if (hasLocation) {
        const lat = Number(data.home?.lat ?? 0);
        const lon = Number(data.home?.lon ?? 0);
        location = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }

      return {
        id: doc.id,
        deviceName,
        deviceSlug: data.deviceSlug || sanitizeDeviceName(deviceName),
        pushoverUserKey: maskedKey,
        platform: data.platform || 'unknown',
        distanceUnit: data.distanceUnit || 'km',
        radiusKm: data.radiusKm || 100,
        notifyProximity: data.notifyProximity || false,
        location,
        address: data.home?.address || '',
        ignoredTypesCount: data.ignoredTypes?.length || 0,
        specialIcaosCount: data.specialIcaos?.length || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    res.status(200).json({
      count: devices.length,
      devices,
    });
  } catch (error: any) {
    logger.error('listAllDevices failed', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export const unsubscribeDevice = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { pushoverUserKey, deviceId } = req.body as {
      pushoverUserKey?: string;
      deviceId?: string; // Allow deleting by specific device ID
    };

    // Support both: delete by pushoverUserKey (current device) or deviceId (any device)
    const docId = deviceId || pushoverUserKey;

    if (!docId || typeof docId !== 'string') {
      res
        .status(400)
        .json({ error: 'pushoverUserKey or deviceId is required' });
      return;
    }

    await db.collection(DEVICE_COLLECTION).doc(docId).delete();

    logger.info('Device unsubscribed', {
      docId: docId.slice(0, 8),
    });

    res
      .status(200)
      .json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error: any) {
    logger.error('unsubscribeDevice failed', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export const debugListTokens = onRequest(async (req: any, res: any) => {
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
});

export const debugSendToken = onRequest(async (req: any, res: any) => {
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
    const response = await fetch('https://api.pushover.net/1/messages.json', {
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
});

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
