/**
 * Aircraft Data Collection Module
 * Handles fetching and storing aircraft data in Firestore
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { AdsBPlane } from '@plane-alert/shared';
import { ORIGIN_HEADER } from './constants';
import {
  DEFAULT_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  type DeviceRegistration,
  type HomeLocation,
  type LocationGroup,
} from './services/aircraft-collector-types';

export {
  DEFAULT_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  type DeviceRegistration,
  type HomeLocation,
  type LocationGroup,
} from './services/aircraft-collector-types';

/**
 * Clamp radius to valid range
 */
export function clampRadius(radiusKm?: number): number {
  if (!radiusKm || radiusKm < MIN_RADIUS_KM) return DEFAULT_RADIUS_KM;
  if (radiusKm > MAX_RADIUS_KM) return MAX_RADIUS_KM;
  return radiusKm;
}

/**
 * Fetch aircraft from ADSB API
 */
export async function fetchAircraft(
  home: HomeLocation,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  const radiusNm = radiusKm / 1.852;
  const baseUrl =
    process.env.ADSB_POINT_API_BASE_URL?.trim() || 'https://api.adsb.lol';
  const url = `${baseUrl.replace(/\/$/, '')}/v2/point/${home.lat}/${
    home.lon
  }/${radiusNm.toFixed(2)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url, {
    headers: {
      'User-Agent': ORIGIN_HEADER,
      Accept: 'application/json',
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!response.ok) {
    logger.warn('ADS-B API error', response.status, response.statusText);
    return [];
  }

  const payload = (await response.json()) as { ac?: AdsBPlane[] };
  return payload.ac ?? [];
}

/**
 * Group devices by location to consolidate API calls
 */
export function groupDevicesByLocation(
  devices: Array<{ id: string; data: DeviceRegistration }>,
): Map<string, LocationGroup> {
  const locationGroups = new Map<string, LocationGroup>();

  devices.forEach(({ id, data }) => {
    if (!data.home) return;

    const radiusKm = clampRadius(data.radiusKm);
    const lat = Math.round(data.home.lat * 100) / 100;
    const lon = Math.round(data.home.lon * 100) / 100;
    const locationKey = `${lat}_${lon}_${radiusKm}`;

    if (!locationGroups.has(locationKey)) {
      locationGroups.set(locationKey, {
        lat,
        lon,
        radiusKm,
        devices: [],
      });
    }
    locationGroups.get(locationKey)!.devices.push(id);
  });

  return locationGroups;
}

/**
 * Store aircraft data in Firestore for a specific location
 */
export async function storeAircraftSnapshot(
  db: admin.firestore.Firestore,
  locationKey: string,
  location: LocationGroup,
  aircraft: AdsBPlane[],
): Promise<void> {
  const docRef = db.collection('aircraft-snapshots').doc(locationKey);

  await docRef.set({
    location: {
      lat: location.lat,
      lon: location.lon,
      radiusKm: location.radiusKm,
    },
    aircraft: aircraft,
    deviceCount: location.devices.length,
    devices: location.devices,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + 2 * 60 * 60 * 1000,
    ),
  });

  logger.info('Aircraft data stored', {
    locationKey,
    aircraftCount: aircraft.length,
    deviceCount: location.devices.length,
  });
}

/**
 * Collect and store aircraft data for all registered device locations
 */
export async function collectAircraftForAllLocations(
  db: admin.firestore.Firestore,
): Promise<void> {
  try {
    const snapshot = await db.collection('deviceTokens').get();

    if (snapshot.empty) {
      logger.info('No registered devices for aircraft collection');
      return;
    }

    const devices = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as DeviceRegistration,
    }));

    const locationGroups = groupDevicesByLocation(devices);

    logger.info('Aircraft collection starting', {
      uniqueLocations: locationGroups.size,
      totalDevices: snapshot.size,
    });

    const tasks = Array.from(locationGroups.entries()).map(
      async ([locationKey, location]) => {
        try {
          const aircraft = await fetchAircraft(
            { lat: location.lat, lon: location.lon },
            location.radiusKm,
          );

          await storeAircraftSnapshot(db, locationKey, location, aircraft);
        } catch (error) {
          logger.error('Failed to fetch/store aircraft for location', {
            locationKey,
            error,
          });
        }
      },
    );

    await Promise.all(tasks);

    logger.info('Aircraft collection complete', {
      locationsProcessed: locationGroups.size,
    });
  } catch (error) {
    logger.error('collectAircraftForAllLocations failed', { error });
    throw error;
  }
}
