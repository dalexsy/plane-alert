import { JsonDocumentStore } from './json-document-store';
import { onSchedule } from './on-request';
import { onRequest } from './on-request';
import { logger } from './pi-logger';
import type { DeviceRegistration } from './types';
import {
  DEVICE_COLLECTION,
  AIRCRAFT_SNAPSHOTS_COLLECTION,
} from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import { clampRadius } from './utils';
import {
  collectAircraftForLocation,
  storeAircraftForLocationGroup,
  type LocationGroup,
} from './services/aircraft-snapshot-store';
import {
  recordCollectAircraftFailure,
  recordCollectAircraftStart,
  recordCollectAircraftSuccess,
} from './services/notification-health';

export { collectAircraftForLocation };

export async function runAircraftCollection(
  db: JsonDocumentStore,
): Promise<void> {
  await recordCollectAircraftStart(db);

  const snapshot = await db.collection(DEVICE_COLLECTION).get();

  if (snapshot.empty) {
    const existingSnapshots = await db
      .collection(AIRCRAFT_SNAPSHOTS_COLLECTION)
      .limit(25)
      .get();

    if (existingSnapshots.empty) {
      logger.info('No registered devices and no existing snapshots');
      await recordCollectAircraftSuccess(db);
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
    await recordCollectAircraftSuccess(db);
    return;
  }

  const locationGroups = new Map<string, LocationGroup>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as unknown as DeviceRegistration;
    const deviceLocation = data.location || (data as any).home;
    if (!deviceLocation) return;

    const radiusKm = clampRadius(data.radiusKm);
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

  const tasks = Array.from(locationGroups.entries()).map(
    async ([locationKey, location]) => {
      try {
        await storeAircraftForLocationGroup(db, locationKey, location);
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
  await recordCollectAircraftSuccess(db);
}

export function createAircraftCollectionFunction(
  db: JsonDocumentStore,
) {
  return onSchedule(
    {
      schedule: '*/2 * * * *', // Every 2 minutes
      timeZone: 'Etc/UTC',
      memory: '256MiB',
      maxInstances: 1,
      region: 'europe-west3',
    },
    async () => {
      try {
        await runAircraftCollection(db);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        logger.error('collectAircraftData failed', { error: message });
        await recordCollectAircraftFailure(db, message);
      }
    },
  );
}

export function createAircraftOnDemandFunction(db: JsonDocumentStore) {
  return onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyCors(res, 'GET, POST, OPTIONS');
    if (handleOptionsPreflight(req, res)) {
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
