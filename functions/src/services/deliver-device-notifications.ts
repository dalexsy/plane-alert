import { JsonDocumentStore } from '../json-document-store';
import type { JsonDocumentReference } from './json-document-store-refs';
import { logger } from '../pi-logger';
import type { DeviceRegistration } from '../types';
import { sendPendingNotification } from './send-pending-notification';
import type { PendingNotification } from './notification-types';

export interface DeliverDeviceNotificationsParams {
  db: JsonDocumentStore;
  deviceRef: JsonDocumentReference;
  docId: string;
  data: DeviceRegistration;
  cooldownDeviceName: string;
  pendingNotifications: PendingNotification[];
  lastNotified: Record<string, number>;
  now: number;
  registeredPushoverDevices?: Set<string> | null;
}

export async function deliverDeviceNotifications(
  params: DeliverDeviceNotificationsParams,
): Promise<Record<string, number>> {
  const {
    db,
    deviceRef,
    docId,
    data,
    cooldownDeviceName,
    pendingNotifications,
    lastNotified,
    now,
    registeredPushoverDevices,
  } = params;

  const updatedLastNotified = { ...lastNotified };
  const sentIcaos = new Set<string>();

  for (const pending of pendingNotifications) {
    if (sentIcaos.has(pending.icao)) {
      logger.info('Skipping duplicate pending notification in batch', {
        docId,
        icao: pending.icao,
      });
      continue;
    }
    sentIcaos.add(pending.icao);

    logger.info('Delivering pending aircraft notification', {
      docId,
      deviceName: pending.deviceName,
      icao: pending.icao,
    });

    const delivered = await sendPendingNotification(
      db,
      deviceRef,
      docId,
      data,
      cooldownDeviceName,
      pending,
      now,
      registeredPushoverDevices,
    );

    if (
      delivered &&
      pending.message.hex &&
      !pending.message.title.startsWith('✈️ Plane Nearby')
    ) {
      updatedLastNotified[pending.icao] = now;
    }
  }

  return updatedLastNotified;
}
