import { JsonDocumentStore } from '../json-document-store';
import type { DeviceRegistration } from '../types';
import { DEVICE_COLLECTION } from '../constants';
import { getDeviceDocId } from '../utils';

/** Link Pushover registration to a PWA installation id (no channel switch). */
export async function linkPushoverDocToInstallation(
  db: JsonDocumentStore,
  installationId: string,
  pushoverUserKey?: string,
  pushoverDeviceName?: string,
): Promise<void> {
  const userKey = pushoverUserKey?.trim();
  const deviceName = pushoverDeviceName?.trim();
  if (!userKey || !deviceName) {
    return;
  }
  const docId = getDeviceDocId(userKey, deviceName);
  const ref = db.collection(DEVICE_COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    return;
  }
  await ref.set(
    { installationId } satisfies Partial<DeviceRegistration>,
    { merge: true },
  );
}
