import { JsonDocumentStore } from '../json-document-store';
import type { DeviceRegistration } from '../types';
import { RECENT_NOTIFICATION_TTL_MS } from '../constants';
import { checkAndMarkNotified } from './notification-cooldown';
import { notificationAccountKey } from './notification-delivery';

export async function claimMilitaryNotificationSend(
  db: JsonDocumentStore,
  data: DeviceRegistration,
  docId: string,
  cooldownDeviceName: string,
  icao: string,
): Promise<boolean> {
  const accountKey = notificationAccountKey(data, docId);
  if (!accountKey) {
    return false;
  }
  return checkAndMarkNotified(
    db,
    accountKey,
    cooldownDeviceName,
    icao,
    RECENT_NOTIFICATION_TTL_MS,
  );
}
