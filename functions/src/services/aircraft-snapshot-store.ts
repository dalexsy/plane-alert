import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { looksMilitary, type AdsBPlane } from '@plane-alert/shared';
import { AIRCRAFT_SNAPSHOTS_COLLECTION } from '../constants';
import { clampRadius, isSpecialAircraft } from '../utils';
import { batchGetFlightData } from './flight-data-cache';
import { fetchAircraftForCollection } from './aircraft-collection-fetch';
import { buildPositionHistory } from './aircraft-position-history.util';

export type LocationGroup = {
  lat: number;
  lon: number;
  radiusKm: number;
  devices: string[];
};

export async function storeAircraftForLocationGroup(
  db: admin.firestore.Firestore,
  locationKey: string,
  location: LocationGroup,
): Promise<void> {
  const aircraft = await fetchAircraftForCollection(
    { lat: location.lat, lon: location.lon },
    location.radiusKm,
  );

  if (aircraft === null) {
    logger.warn('Skipping Firestore update due to API failure', {
      locationKey,
    });
    return;
  }

  const validAircraft: AdsBPlane[] = aircraft;

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
    militaryOrSpecialWithFlight: militaryOrSpecialPlanesWithFlight.length,
    milFieldTrue: planesWithFlight.filter((p) => p.mil === true).length,
    dbFlagsIs1: planesWithFlight.filter((p) => p.dbFlags === 1).length,
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

  const docRef = db
    .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
    .doc(locationKey);

  const existingDoc = await docRef.get();
  const existingData = existingDoc.exists ? existingDoc.data() : null;
  const existingHistory = existingData?.history || {};
  const history = buildPositionHistory(validAircraft, existingHistory);

  await docRef.set({
    location: {
      lat: location.lat,
      lon: location.lon,
      radiusKm: location.radiusKm,
    },
    aircraft: validAircraft,
    flightData: Object.fromEntries(flightDataMap),
    history: history,
    deviceCount: location.devices.length,
    devices: location.devices,
    // Date.now() — do not use FieldValue.serverTimestamp(); admin.firestore is a
    // getter that returns a fresh namespace each access, so LocalFieldValue patches
    // never stick and Sentinels JSON-serialize to `{}` (perpetual stale cache).
    timestamp: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  });

  logger.info('Aircraft data stored', {
    locationKey,
    aircraftCount: validAircraft.length,
    deviceCount: location.devices.length,
  });
}

/**
 * Shared logic to collect aircraft for a specific location
 * Used by both scheduled collection and on-demand requests
 */
export async function collectAircraftForLocation(
  db: admin.firestore.Firestore,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<AdsBPlane[]> {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const clampedRadius = clampRadius(radiusKm);
  const locationKey = `${roundedLat}_${roundedLon}_${clampedRadius}`;

  try {
    const aircraft = await fetchAircraftForCollection(
      { lat: roundedLat, lon: roundedLon },
      clampedRadius,
    );

    if (aircraft === null) {
      throw new Error('ADS-B API failed');
    }

    const validAircraft: AdsBPlane[] = aircraft;

    const docRef = db
      .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
      .doc(locationKey);

    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    const existingHistory = existingData?.history || {};
    const history = buildPositionHistory(validAircraft, existingHistory);

    await docRef.set({
      location: {
        lat: roundedLat,
        lon: roundedLon,
        radiusKm: clampedRadius,
      },
      aircraft: validAircraft,
      history: history,
      deviceCount: 0,
      devices: [],
      timestamp: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
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
