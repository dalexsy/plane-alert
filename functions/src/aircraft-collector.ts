import { JsonDocumentStore } from './json-document-store';
/**
 * Aircraft data collection — fetch ADS-B and persist snapshots in the Pi JSON store.
 */

import { logger } from './pi-logger';
import { AdsBPlane } from '@plane-alert/shared';
import {
  DEFAULT_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  type DeviceRegistration,
  type HomeLocation,
  type LocationGroup,
} from './services/aircraft-collector-types';
import { fetchAdsbPointNonEmpty } from './services/aircraft-adsb-point';

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
  const ac = await fetchAdsbPointNonEmpty(home.lat, home.lon, radiusKm);
  if (ac?.length) return ac;
  logger.warn('ADS-B collection empty after all sources', {
    lat: home.lat,
    lon: home.lon,
    radiusKm,
  });
  return [];
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
  db: JsonDocumentStore,
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
    // Plain millis — DocumentFieldValue.serverTimestamp() is Date.now(); store numbers.
    timestamp: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
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
  db: JsonDocumentStore,
): Promise<void> {
  try {
    const snapshot = await db.collection('deviceTokens').get();

    if (snapshot.empty) {
      logger.info('No registered devices for aircraft collection');
      return;
    }

    const devices = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as unknown as DeviceRegistration,
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
