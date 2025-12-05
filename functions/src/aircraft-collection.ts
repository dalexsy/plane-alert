import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import type { AdsBPlane } from '@plane-alert/shared';
import type { DeviceRegistration, Location } from './types';
import {
  DEVICE_COLLECTION,
  AIRCRAFT_SNAPSHOTS_COLLECTION,
  ORIGIN_HEADER,
} from './constants';
import { clampRadius } from './utils';

async function fetchAircraft(
  location: Location,
  radiusKm: number
): Promise<AdsBPlane[] | null> {
  const radiusNm = radiusKm / 1.852;
  const url = `https://api.adsb.one/v2/point/${location.lat}/${
    location.lon
  }/${radiusNm.toFixed(2)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': ORIGIN_HEADER,
        Accept: 'application/json',
      },
      timeout: 5000,
    } as any);

    if (!response.ok) {
      logger.warn('ADS-B API error', response.status, response.statusText);
      // Return null to indicate API failure (don't overwrite existing data)
      return null;
    }

    const payload = (await response.json()) as { ac?: AdsBPlane[] };
    return payload.ac ?? [];
  } catch (error) {
    logger.error('Failed to fetch from ADS-B API', {
      error,
      location,
      radiusKm,
    });
    // Return null to indicate fetch failure
    return null;
  }
}

export function createAircraftCollectionFunction(
  db: admin.firestore.Firestore
) {
  return onSchedule(
    {
      schedule: '* * * * *', // Every minute (cron format)
      timeZone: 'Etc/UTC',
      memory: '256MiB',
    },
    async () => {
      try {
        // Get all registered devices to determine locations to fetch
        const snapshot = await db.collection(DEVICE_COLLECTION).get();

        if (snapshot.empty) {
          logger.info('No registered devices for aircraft collection');
          return;
        }

        // Group devices by location to consolidate API calls
        const locationGroups = new Map<
          string,
          {
            lat: number;
            lon: number;
            radiusKm: number;
            devices: string[];
          }
        >();

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as DeviceRegistration;
          const deviceLocation = data.location || (data as any).home;
          if (!deviceLocation) return;

          const radiusKm = clampRadius(data.radiusKm);
          // Round to 2 decimal places for location grouping
          const lat = Math.round(deviceLocation.lat * 100) / 100;
          const lon = Math.round(deviceLocation.lon * 100) / 100;
          const locationKey = `${lat}_${lon}_${radiusKm}`;

          if (!locationGroups.has(locationKey)) {
            locationGroups.set(locationKey, {
              lat,
              lon,
              radiusKm,
              devices: [],
            });
          }
          locationGroups.get(locationKey)!.devices.push(doc.id);
        });

        logger.info('Aircraft collection starting', {
          uniqueLocations: locationGroups.size,
          totalDevices: snapshot.size,
        });

        // Fetch and store aircraft data for each unique location
        const tasks = Array.from(locationGroups.entries()).map(
          async ([locationKey, location]) => {
            try {
              const aircraft = await fetchAircraft(
                { lat: location.lat, lon: location.lon },
                location.radiusKm
              );

              // If API failed, skip updating Firestore (keep existing data)
              if (aircraft === null) {
                logger.warn('Skipping Firestore update due to API failure', {
                  locationKey,
                });
                return;
              }

              // Type guard: aircraft is now definitely AdsBPlane[]
              const validAircraft: AdsBPlane[] = aircraft;

              // Get existing document to merge position history
              const docRef = db
                .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
                .doc(locationKey);

              const existingDoc = await docRef.get();
              const existingData = existingDoc.exists
                ? existingDoc.data()
                : null;
              const existingHistory = existingData?.history || {};

              // Build position history for each aircraft (keep last 20 positions = ~20 minutes)
              const now = Date.now();
              const history: Record<
                string,
                Array<{ lat: number; lon: number; timestamp: number }>
              > = {};

              validAircraft.forEach((plane) => {
                const icao = plane.hex?.toUpperCase();
                if (
                  !icao ||
                  typeof plane.lat !== 'number' ||
                  typeof plane.lon !== 'number'
                )
                  return;

                // Get existing history for this plane
                const planeHistory = existingHistory[icao] || [];

                // Add new position
                planeHistory.push({
                  lat: plane.lat,
                  lon: plane.lon,
                  timestamp: now,
                });

                // Keep only last 20 positions (prune old data)
                history[icao] = planeHistory.slice(-20);
              });

              await docRef.set({
                location: {
                  lat: location.lat,
                  lon: location.lon,
                  radiusKm: location.radiusKm,
                },
                aircraft: validAircraft,
                history: history, // Position history for trails
                deviceCount: location.devices.length,
                devices: location.devices,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromMillis(
                  Date.now() + 2 * 60 * 60 * 1000 // 2 hours TTL
                ),
              });

              logger.info('Aircraft data stored', {
                locationKey,
                aircraftCount: validAircraft.length,
                deviceCount: location.devices.length,
              });
            } catch (error) {
              logger.error('Failed to fetch/store aircraft for location', {
                locationKey,
                error,
              });
            }
          }
        );

        await Promise.all(tasks);

        logger.info('Aircraft collection complete', {
          locationsProcessed: locationGroups.size,
        });
      } catch (error) {
        logger.error('collectAircraftData failed', { error });
      }
    }
  );
}

/**
 * Shared logic to collect aircraft for a specific location
 * Used by both scheduled collection and on-demand requests
 */
async function collectAircraftForLocation(
  db: admin.firestore.Firestore,
  lat: number,
  lon: number,
  radiusKm: number
): Promise<void> {
  // Round coordinates for consistent caching
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const clampedRadius = clampRadius(radiusKm);
  const locationKey = `${roundedLat}_${roundedLon}_${clampedRadius}`;

  try {
    const aircraft = await fetchAircraft(
      { lat: roundedLat, lon: roundedLon },
      clampedRadius
    );

    // If API failed, throw error
    if (aircraft === null) {
      throw new Error('ADS-B API failed');
    }

    // Type guard: aircraft is now definitely AdsBPlane[]
    const validAircraft: AdsBPlane[] = aircraft;

    // Get existing document to merge position history
    const docRef = db
      .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
      .doc(locationKey);

    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    const existingHistory = existingData?.history || {};

    // Build position history for each aircraft (keep last 20 positions = ~20 minutes)
    const now = Date.now();
    const history: Record<
      string,
      Array<{ lat: number; lon: number; timestamp: number }>
    > = {};

    validAircraft.forEach((plane) => {
      const icao = plane.hex?.toUpperCase();
      if (
        !icao ||
        typeof plane.lat !== 'number' ||
        typeof plane.lon !== 'number'
      )
        return;

      // Get existing history for this plane
      const planeHistory = existingHistory[icao] || [];

      // Add new position
      planeHistory.push({
        lat: plane.lat,
        lon: plane.lon,
        timestamp: now,
      });

      // Keep only last 20 positions (prune old data)
      history[icao] = planeHistory.slice(-20);
    });

    await docRef.set({
      location: {
        lat: roundedLat,
        lon: roundedLon,
        radiusKm: clampedRadius,
      },
      aircraft: validAircraft,
      history: history, // Position history for trails
      deviceCount: 0, // On-demand requests don't have associated devices
      devices: [],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + 2 * 60 * 60 * 1000 // 2 hours TTL
      ),
    });

    logger.info('On-demand aircraft data collected', {
      locationKey,
      aircraftCount: validAircraft.length,
    });
  } catch (error) {
    logger.error('Failed to collect aircraft on-demand', {
      locationKey,
      error,
    });
    throw error;
  }
}

export { collectAircraftForLocation };
