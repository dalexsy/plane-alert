import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

import express from 'express';
import cron from 'node-cron';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import {
  createLocalFirestore,
  patchAdminFirestoreNamespace,
} from './local-firestore';
import { createDeviceManagementFunctions } from './device-management';
import { runNotificationProcessing } from './notification-processor';
import { runAircraftCollection } from './aircraft-collection';
import { runNotificationHealthWatchdog } from './notification-health-watchdog';
import { adsbPointProxy } from './adsb-point-proxy';
import { createMilitaryHistoryFunctions } from './military-history';
import { seedDefaultDeviceRegistrations } from './services/seed-default-device-registrations';
import { readPlanesApiBuildInfo } from './services/planes-api-build-info';
import { buildPlanesApiHealthResponse } from './services/planes-api-health';
import { readNotificationHealth } from './services/notification-health';
import { DEVICE_COLLECTION } from './constants';

patchAdminFirestoreNamespace(admin);
const buildInfo = readPlanesApiBuildInfo();

const storePath =
  process.env.PLANES_API_STORE_PATH?.trim() ||
  path.join(process.cwd(), 'data', 'planes-api-store.json');

const db = createLocalFirestore(storePath) as unknown as admin.firestore.Firestore;

const app = express();
app.use(express.json({ limit: '1mb' }));

const deviceFunctions = createDeviceManagementFunctions(db);
const militaryHistoryFunctions = createMilitaryHistoryFunctions(db);
const PORT = Number(process.env.PORT || 8795);

type HttpHandler = (
  req: express.Request,
  res: express.Response,
) => void | Promise<void>;

function bindHandler(handler: HttpHandler) {
  return (req: express.Request, res: express.Response) => {
    void handler(req, res);
  };
}

app.all(
  '/registerDevice',
  bindHandler(deviceFunctions.registerDevice as unknown as HttpHandler),
);
app.all(
  '/checkDevice',
  bindHandler(deviceFunctions.checkDevice as unknown as HttpHandler),
);
app.all(
  '/adsbPointProxy',
  bindHandler(adsbPointProxy as unknown as HttpHandler),
);
app.all(
  '/getMilitaryHistory',
  bindHandler(
    militaryHistoryFunctions.getMilitaryHistory as unknown as HttpHandler,
  ),
);
app.all(
  '/saveMilitarySighting',
  bindHandler(
    militaryHistoryFunctions.saveMilitarySighting as unknown as HttpHandler,
  ),
);

app.get('/health', async (_req, res) => {
  try {
    const devices = await db.collection(DEVICE_COLLECTION).get();
    const health = await readNotificationHealth(db);
    res.json(
      buildPlanesApiHealthResponse({
        storePath,
        build: buildInfo,
        deviceCount: devices.size,
        health,
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('health handler failed', { error: message });
    res.status(500).json({
      ok: false,
      service: 'planes-api',
      storePath,
      version: buildInfo.version,
      gitSha: buildInfo.gitSha,
      error: message,
    });
  }
});

/** Browser reverse-geocode — never call nominatim from the SPA (504 / CORS / no nginx proxy). */
app.get('/reverseGeocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ ok: false, error: 'lat and lon required' });
    return;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ ok: false, error: 'lat/lon out of range' });
    return;
  }
  try {
    const { reverseGeocodeDetailed } = await import('./services/geocoding');
    const result = await reverseGeocodeDetailed(lat, lon);
    // Never return lat/lon as "address" — humans cannot read coordinates.
    res.json({
      ok: true,
      address: result.address ?? '',
      addressDetails: result.details,
      fallback: !result.address,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('reverseGeocode handler failed', { lat, lon, error: message });
    res.json({
      ok: true,
      address: '',
      addressDetails: null,
      fallback: true,
    });
  }
});

async function safeRun(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`${label} failed`, { error: message });
  }
}

app.listen(PORT, '127.0.0.1', () => {
  logger.info(`planes-api listening on 127.0.0.1:${PORT}`, { storePath });

  void seedDefaultDeviceRegistrations(db).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Default device registration seed failed', { error: message });
  });

  // Collect every 5 min; process every 2 min so brief mil flyovers still chime.
  cron.schedule('*/5 * * * *', () =>
    safeRun('collectAircraftData', () => runAircraftCollection(db)),
  );
  cron.schedule('*/2 * * * *', () =>
    safeRun('processPlanes', () => runNotificationProcessing(db)),
  );
  cron.schedule('*/15 * * * *', () =>
    safeRun('notificationHealthWatchdog', () =>
      runNotificationHealthWatchdog(db),
    ),
  );
});
