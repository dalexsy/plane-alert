import * as admin from 'firebase-admin';
import {
  SYSTEM_HEALTH_COLLECTION,
  NOTIFICATION_HEALTH_DOC_ID,
} from '../constants';

export interface NotificationHealthState {
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

function healthRef(db: admin.firestore.Firestore) {
  return db
    .collection(SYSTEM_HEALTH_COLLECTION)
    .doc(NOTIFICATION_HEALTH_DOC_ID);
}

export async function readNotificationHealth(
  db: admin.firestore.Firestore,
): Promise<NotificationHealthState> {
  const snap = await healthRef(db).get();
  return (snap.data() as NotificationHealthState) ?? {};
}

async function mergeHealth(
  db: admin.firestore.Firestore,
  patch: Partial<NotificationHealthState>,
): Promise<void> {
  await healthRef(db).set(patch, { merge: true });
}

export async function recordProcessPlanesStart(
  db: admin.firestore.Firestore,
  deviceCount: number,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastRunAt: Date.now(),
    processPlanesDeviceCount: deviceCount,
    processPlanesLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordProcessPlanesSuccess(
  db: admin.firestore.Firestore,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastSuccessAt: Date.now(),
    processPlanesLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordProcessPlanesFailure(
  db: admin.firestore.Firestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    processPlanesLastRunAt: Date.now(),
    processPlanesLastError: error.slice(0, 500),
  });
}

export async function recordCollectAircraftStart(
  db: admin.firestore.Firestore,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastRunAt: Date.now(),
    collectAircraftLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordCollectAircraftSuccess(
  db: admin.firestore.Firestore,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastSuccessAt: Date.now(),
    collectAircraftLastError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordCollectAircraftFailure(
  db: admin.firestore.Firestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    collectAircraftLastRunAt: Date.now(),
    collectAircraftLastError: error.slice(0, 500),
  });
}

export async function recordNotificationSent(
  db: admin.firestore.Firestore,
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
  db: admin.firestore.Firestore,
): Promise<void> {
  await mergeHealth(db, {
    watchdogLastRecoveryAt: Date.now(),
    watchdogLastRecoveryError: admin.firestore.FieldValue.delete() as any,
  });
}

export async function recordWatchdogRecoveryFailure(
  db: admin.firestore.Firestore,
  error: string,
): Promise<void> {
  await mergeHealth(db, {
    watchdogLastRecoveryAt: Date.now(),
    watchdogLastRecoveryError: error.slice(0, 500),
  });
}