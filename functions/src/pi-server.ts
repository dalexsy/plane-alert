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

patchAdminFirestoreNamespace(admin);

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'planes-api', storePath });
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

  // Every 5 minutes — enough for two users; no Cloud Scheduler billing.
  cron.schedule('*/5 * * * *', () =>
    safeRun('collectAircraftData', () => runAircraftCollection(db)),
  );
  cron.schedule('2,7,12,17,22,27,32,37,42,47,52,57 * * * *', () =>
    safeRun('processPlanes', () => runNotificationProcessing(db)),
  );
  cron.schedule('*/15 * * * *', () =>
    safeRun('notificationHealthWatchdog', () =>
      runNotificationHealthWatchdog(db),
    ),
  );
});
