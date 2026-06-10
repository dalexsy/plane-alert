import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  DEVICE_COLLECTION,
  NOTIFICATION_HEALTH_STALE_MS,
} from './constants';
import { runAircraftCollection } from './aircraft-collection';
import { runNotificationProcessing } from './notification-processor';
import {
  readNotificationHealth,
  recordWatchdogRecovery,
  recordWatchdogRecoveryFailure,
} from './services/notification-health';

function isStale(timestamp: number | undefined, now: number): boolean {
  return !timestamp || now - timestamp > NOTIFICATION_HEALTH_STALE_MS;
}

function describeStalls(
  health: Awaited<ReturnType<typeof readNotificationHealth>>,
  now: number,
): string[] {
  const stalls: string[] = [];
  if (isStale(health.processPlanesLastSuccessAt, now)) {
    stalls.push('processPlanes');
  }
  if (isStale(health.collectAircraftLastSuccessAt, now)) {
    stalls.push('collectAircraft');
  }
  return stalls;
}

export function createNotificationHealthWatchdog(
  db: admin.firestore.Firestore,
) {
  return onSchedule(
    {
      schedule: '*/5 * * * *',
      timeZone: 'Etc/UTC',
      maxInstances: 1,
      region: 'europe-west3',
    },
    async () => {
      const deviceSnapshot = await db.collection(DEVICE_COLLECTION).get();
      if (deviceSnapshot.empty) {
        return;
      }

      const now = Date.now();
      const health = await readNotificationHealth(db);
      const stalls = describeStalls(health, now);

      if (!stalls.length) {
        return;
      }

      logger.warn('Notification pipeline stalled, attempting recovery', {
        stalls,
      });

      try {
        if (isStale(health.processPlanesLastSuccessAt, now)) {
          await runNotificationProcessing(db);
        }
        if (isStale(health.collectAircraftLastSuccessAt, now)) {
          await runAircraftCollection(db);
        }

        const after = await readNotificationHealth(db);
        const remaining = describeStalls(after, now);
        if (remaining.length) {
          await recordWatchdogRecoveryFailure(
            db,
            `still stalled after recovery: ${remaining.join(', ')}`,
          );
          logger.warn('Recovery incomplete', { remaining });
          return;
        }

        await recordWatchdogRecovery(db);
        logger.info('Notification pipeline recovered');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        await recordWatchdogRecoveryFailure(db, message);
        logger.error('Watchdog recovery failed', { error: message });
      }
    },
  );
}