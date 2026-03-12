import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { looksMilitary, type AdsBPlane } from '@plane-alert/shared';
import type { DeviceRegistration, Location } from './types';
import {
  DEVICE_COLLECTION,
  AIRCRAFT_SNAPSHOTS_COLLECTION,
  ORIGIN_HEADER,
} from './constants';
import { clampRadius, isSpecialAircraft } from './utils';
import { batchGetFlightData } from './services/flight-data-cache';

async function fetchWithTimeout(
  url: string,
  init: any,
  timeoutMs: number,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal } as any);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAircraft(
  location: Location,
  radiusKm: number,
): Promise<AdsBPlane[] | null> {
  const fetchFromOpenSky = async (): Promise<AdsBPlane[] | null> => {
    // OpenSky bounding box query (approximate):
    // https://opensky-network.org/api/states/all?lamin=..&lomin=..&lamax=..&lomax=..
    const latDelta = radiusKm / 111.32;
    const cosLat = Math.cos((location.lat * Math.PI) / 180);
    const lonDelta = radiusKm / (111.32 * Math.max(cosLat, 0.01));

    const lamin = location.lat - latDelta;
    const lamax = location.lat + latDelta;
    const lomin = location.lon - lonDelta;
    const lomax = location.lon + lonDelta;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': ORIGIN_HEADER,
            Accept: 'application/json',
          },
        },
        8000,
      );

      if (!response.ok) {
        logger.warn('OpenSky API error', response.status, response.statusText);
        return null;
      }

      const payload = (await response.json()) as any;
      const states: any[] = Array.isArray(payload?.states)
        ? payload.states
        : [];

      const planes: AdsBPlane[] = states
        .map((s: any[]): AdsBPlane | null => {
          const icao24 = typeof s?.[0] === 'string' ? s[0] : null;
          const callsignRaw = typeof s?.[1] === 'string' ? s[1] : '';
          const lon = typeof s?.[5] === 'number' ? s[5] : null;
          const lat = typeof s?.[6] === 'number' ? s[6] : null;
          if (!icao24 || lat === null || lon === null) return null;

          const baroAltM = typeof s?.[7] === 'number' ? s[7] : null;
          const onGround = s?.[8] === true;
          const velocityMs = typeof s?.[9] === 'number' ? s[9] : null;
          const trueTrack = typeof s?.[10] === 'number' ? s[10] : null;
          const verticalRateMs = typeof s?.[11] === 'number' ? s[11] : null;
          const geoAltM = typeof s?.[13] === 'number' ? s[13] : null;
          const squawk = typeof s?.[14] === 'string' ? s[14] : undefined;

          const knotsPerMs = 1.94384;
          const feetPerMeter = 3.28084;

          return {
            hex: icao24.toUpperCase(),
            flight: callsignRaw.trim() || undefined,
            callsign: callsignRaw.trim() || undefined,
            lat,
            lon,
            gs: velocityMs !== null ? velocityMs * knotsPerMs : undefined,
            track: trueTrack !== null ? trueTrack : undefined,
            alt_baro:
              baroAltM !== null
                ? Math.round(baroAltM * feetPerMeter)
                : undefined,
            alt_geom:
              geoAltM !== null ? Math.round(geoAltM * feetPerMeter) : undefined,
            baro_rate:
              verticalRateMs !== null
                ? Math.round(verticalRateMs * feetPerMeter * 60)
                : undefined, // ft/min
            gnd: onGround,
            squawk,
          };
        })
        .filter((p: AdsBPlane | null): p is AdsBPlane => p !== null);

      return planes;
    } catch (error) {
      logger.error('Failed to fetch from OpenSky', {
        error,
        location,
        radiusKm,
      });
      return null;
    }
  };

  const radiusNm = radiusKm / 1.852;
  const baseUrl =
    process.env.ADSB_POINT_API_BASE_URL?.trim() || 'https://api.adsb.lol';
  const url = `${baseUrl}/v2/point/${location.lat}/${location.lon}/${radiusNm.toFixed(
    2,
  )}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': ORIGIN_HEADER,
          Accept: 'application/json',
        },
      },
      5000,
    );

    if (!response.ok) {
      // adsb.one now frequently returns 403 due to WAF / policy changes.
      // Fall back to OpenSky to keep the app functional.
      if (response.status === 401 || response.status === 403) {
        logger.warn('ADS-B One blocked; falling back to OpenSky', {
          status: response.status,
        });
        return await fetchFromOpenSky();
      }

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
  db: admin.firestore.Firestore,
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
          // Fall back to refreshing existing snapshot locations.
          // This keeps the app working if device registrations were cleared.
          const existingSnapshots = await db
            .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
            .limit(25)
            .get();

          if (existingSnapshots.empty) {
            logger.info('No registered devices and no existing snapshots');
            return;
          }

          const tasks = existingSnapshots.docs.map(async (doc) => {
            const data = doc.data() as any;
            const loc = data?.location;
            const lat = loc?.lat;
            const lon = loc?.lon;
            const radiusKm = loc?.radiusKm;
            if (
              typeof lat !== 'number' ||
              typeof lon !== 'number' ||
              typeof radiusKm !== 'number'
            ) {
              return;
            }

            try {
              await collectAircraftForLocation(db, lat, lon, radiusKm);
            } catch (error) {
              logger.error('Fallback refresh failed', {
                locationKey: doc.id,
                error,
              });
            }
          });

          await Promise.all(tasks);

          logger.info('Fallback aircraft refresh complete', {
            snapshotsRefreshed: existingSnapshots.size,
          });
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
                location.radiusKm,
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

              // Enrich with AeroAPI flight data for MILITARY and SPECIAL aircraft (cost control)
              const planesWithFlight = validAircraft.filter((plane) =>
                Boolean(plane.flight && plane.flight.trim()),
              );
              const militaryOrSpecialPlanesWithFlight = planesWithFlight.filter(
                (plane) => looksMilitary(plane) || isSpecialAircraft(plane.hex),
              );
              const callsigns = militaryOrSpecialPlanesWithFlight.map((plane) =>
                plane.flight!.trim(),
              );

              logger.info('Processing aircraft for flight data', {
                locationKey,
                totalAircraft: validAircraft.length,
                planesWithFlight: planesWithFlight.length,
                militaryOrSpecialWithFlight:
                  militaryOrSpecialPlanesWithFlight.length,
                milFieldTrue: planesWithFlight.filter((p) => p.mil === true)
                  .length,
                dbFlagsIs1: planesWithFlight.filter((p) => p.dbFlags === 1)
                  .length,
                callsignsFound: callsigns.length,
                sampleCallsigns: callsigns.slice(0, 5),
              });

              let flightDataMap = new Map();
              if (callsigns.length > 0) {
                try {
                  flightDataMap = await batchGetFlightData(db, callsigns);
                  logger.info('Fetched flight data for aircraft', {
                    locationKey,
                    callsignsQueried: callsigns.length,
                    dataReceived: flightDataMap.size,
                    sampleData: Array.from(flightDataMap.entries()).slice(0, 2),
                  });
                } catch (error) {
                  logger.warn('Failed to fetch flight data batch', {
                    error,
                    locationKey,
                  });
                }
              } else {
                logger.info('No callsigns to query for flight data', {
                  locationKey,
                });
              }

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
                flightData: Object.fromEntries(flightDataMap), // O/D/ETA data keyed by callsign
                history: history, // Position history for trails
                deviceCount: location.devices.length,
                devices: location.devices,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromMillis(
                  Date.now() + 2 * 60 * 60 * 1000, // 2 hours TTL
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
          },
        );

        await Promise.all(tasks);

        logger.info('Aircraft collection complete', {
          locationsProcessed: locationGroups.size,
        });
      } catch (error) {
        logger.error('collectAircraftData failed', { error });
      }
    },
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
  radiusKm: number,
): Promise<AdsBPlane[]> {
  // Round coordinates for consistent caching
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const clampedRadius = clampRadius(radiusKm);
  const locationKey = `${roundedLat}_${roundedLon}_${clampedRadius}`;

  try {
    const aircraft = await fetchAircraft(
      { lat: roundedLat, lon: roundedLon },
      clampedRadius,
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
        Date.now() + 2 * 60 * 60 * 1000, // 2 hours TTL
      ),
    });

    logger.info('On-demand aircraft data collected', {
      locationKey,
      aircraftCount: validAircraft.length,
    });

    return validAircraft;
  } catch (error) {
    logger.error('Failed to collect aircraft on-demand', {
      locationKey,
      error,
    });
    throw error;
  }
}

export { collectAircraftForLocation };

export function createAircraftOnDemandFunction(db: admin.firestore.Firestore) {
  return onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const latRaw =
      req.method === 'GET' ? (req.query.lat as any) : (req.body as any)?.lat;
    const lonRaw =
      req.method === 'GET' ? (req.query.lon as any) : (req.body as any)?.lon;
    const radiusRaw =
      req.method === 'GET'
        ? (req.query.radiusKm as any)
        : (req.body as any)?.radiusKm;

    const lat = typeof latRaw === 'string' ? Number(latRaw) : latRaw;
    const lon = typeof lonRaw === 'string' ? Number(lonRaw) : lonRaw;
    const radiusKm =
      typeof radiusRaw === 'string' ? Number(radiusRaw) : radiusRaw;

    if (
      typeof lat !== 'number' ||
      Number.isNaN(lat) ||
      typeof lon !== 'number' ||
      Number.isNaN(lon)
    ) {
      res.status(400).json({ error: 'lat and lon are required numbers' });
      return;
    }

    try {
      const aircraft = await collectAircraftForLocation(
        db,
        lat,
        lon,
        clampRadius(radiusKm),
      );
      res.status(200).json({ success: true, aircraft });
    } catch (error: any) {
      logger.error('collectAircraftOnDemand failed', {
        error: error?.message,
      });
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
