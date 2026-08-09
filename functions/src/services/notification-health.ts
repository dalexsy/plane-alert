import { LocalFirestore } from '../local-firestore';
import { logger } from '../pi-logger';
import * as admin from '../admin-compat';
import {
  PROCESS_PLANES_LOCK_TTL_MS,
  SYSTEM_HEALTH_COLLECTION,
  NOTIFICATION_HEALTH_DOC_ID,
} from '../constants';

export interface NotificationHealthState {
  processPlanesLockedAt?: number;
  processPlanesLastRunAt?: number;
  processPlanesLastSuccessAt?: number;
  processPlanesLastError?: string;
  processPlanesDeviceCount?: number;
  collectAircraftLastRunAt?: number;
  collectAircraftLastSuccessAt?: number;
  collectAircraftLastError?: string;
  lastNotificationSentAt?: number;
  notificationsSentTotal?: number;
  watchdogLastRecoveryAt?: number;
  watchdogLastRecoveryError?: string;
}

function healthRef(db: LocalFirestore) {
  return db
    .collection(SYSTEM_HEALTH_COLLECTION)
    .doc(NOTIFICATION_HEALTH_DOC_ID);
}

export async function readNotificationHealth(
  db: LocalFirestore,
): Promise<NotificationHealthState> {
  const snap = await healthRef(db).get();
  return (snap.data() as NotificationHealthState) ?? {};
}

async function mergeHealth(
  db: LocalFirestore,
  patch: Partial<NotificationHealthState>,
): Promise<void> {
  await healthRef(db).set(patch, { merge: true });
}

export async function tryAcquireProcessPlanesLock(
  db: LocalFirestore,
): Promise<boolean> {
  const ref = healthRef(db);

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const data = (snap.data() as NotificationHealthState | undefined) ?? {};
      const now = Date.now();
      const lockedAt = data.processPlanesLockedAt;

      if (lockedAt && now - lockedAt < PROCESS_PLANES_LOCK_TTL_MS) {
        return false;
      }

      transaction.set(ref, { processPlanesLockedAt: now }, { merge: true });
      return true;
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to acquire processPlanes lock', { error: message });
    return false;
  }
}

export async function releaseProcessPlanesLock(
  db: LocalFirestore,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLockedAt: admin.firestore.FieldValue.delete() as any,
  });
}

export function isProcessPlanesLockHeld(
  health: NotificationHealthState,
  now = Date.now(),
): boolean {
  const lockedAt = health.processPlanesLockedAt;
  return Boolean(
    lockedAt && now - lockedAt < PROCESS_PLANES_LOCK_TTL_MS,
  );
}

export async function recordProcessPlanesStart(
  db: LocalFirestore,
  deviceCount: number,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastRunAt: Date.now(),
    processPlanesDeviceCount: deviceCount,
    processPlanesLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordProcessPlanesSuccess(
  db: LocalFirestore,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastSuccessAt: Date.now(),
    processPlanesLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordProcessPlanesFailure(
  db: LocalFirestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastRunAt: Date.now(),
    processPlanesLastError: error.slice(0, 500),
  });
}

export async function recordCollectAircraftStart(
  db: LocalFirestore,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastRunAt: Date.now(),
    collectAircraftLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordCollectAircraftSuccess(
  db: LocalFirestore,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastSuccessAt: Date.now(),
    collectAircraftLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordCollectAircraftFailure(
  db: LocalFirestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastRunAt: Date.now(),
    collectAircraftLastError: error.slice(0, 500),
  });
}

export async function recordNotificationSent(
  db: LocalFirestore,
): Promise<void> {
  const now = Date.now();
  await healthRef(db).set(
    {
      lastNotificationSentAt: now,
      notificationsSentTotal: admin.firestore.FieldValue.increment(1),
    },
    { merge: true },
  );
}

export async function recordWatchdogRecovery(
  db: LocalFirestore,
): Promise<void> {
  await mergeHealth(db, {
    watchdogLastRecoveryAt: Date.now(),
    watchdogLastRecoveryError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordWatchdogRecoveryFailure(
  db: LocalFirestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    watchdogLastRecoveryAt: Date.now(),
    watchdogLastRecoveryError: error.slice(0, 500),
  });
}