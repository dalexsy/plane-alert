import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from '../types';
import { MILITARY_HISTORY_COLLECTION } from '../constants';
import {
  releaseNotificationClaim,
} from './notification-cooldown';
import { sendPushoverNotification } from './pushover-client';
import { recordNotificationSent } from './notification-health';
import type { PendingNotification } from './notification-types';

export interface DeliverDeviceNotificationsParams {
  db: admin.firestore.Firestore;
  docId: string;
  data: DeviceRegistration;
  cooldownDeviceName: string;
  pendingNotifications: PendingNotification[];
  lastNotified: Record<string, number>;
  now: number;
}

export async function deliverDeviceNotifications(
  params: DeliverDeviceNotificationsParams,
): Promise<Record<string, number>> {
  const {
    db,
    docId,
    data,
    cooldownDeviceName,
    pendingNotifications,
    lastNotified,
    now,
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
    logger.info('Sending notification for pending aircraft', {
      docId,
      deviceName: pending.deviceName,
      icao: pending.icao,
      targetDevice: pending.deviceName || 'ALL_DEVICES',
    });

    const sent = await sendPushoverNotification(
      data.pushoverUserKey,
      pending.deviceName,
      pending.message,
      docId,
    );

    if (!sent) {
      logger.warn('Notification send failed', {
        docId,
        deviceName: pending.deviceName,
        icao: pending.icao,
      });
      await releaseNotificationClaim(
        db,
        data.pushoverUserKey,
        cooldownDeviceName,
        pending.icao,
      );
      continue;
    }

    logger.info('Notification sent successfully', {
      docId,
      deviceName: pending.deviceName,
      icao: pending.icao,
    });

    await recordNotificationSent(db);

    if (
      pending.message.hex &&
      !pending.message.title.startsWith('✈️ Plane Nearby')
    ) {
      updatedLastNotified[pending.icao] = now;

      const historyDocId = `${data.pushoverUserKey}__${pending.icao.toLowerCase()}`;
      const historyRef = db
        .collection(MILITARY_HISTORY_COLLECTION)
        .doc(historyDocId);
      const existingSighting = await historyRef.get();

      const historyPayload = {
        lastSeen: now,
        notificationDelivered: true,
        notifiedDeviceName: data.deviceName,
        notificationLocation: pending.location,
        ...(pending.callsign && { callsign: pending.callsign }),
        ...(pending.model && { model: pending.model }),
        ...(pending.countryCode && { country: pending.countryCode }),
        ...(pending.registration && { registration: pending.registration }),
        ...(pending.lat != null && { lat: pending.lat }),
        ...(pending.lon != null && { lon: pending.lon }),
        ...(pending.altitude != null && { altitude: pending.altitude }),
        ...(pending.bearing != null && { bearing: pending.bearing }),
        ...(pending.cardinal && { cardinal: pending.cardinal }),
      };

      if (existingSighting.exists) {
        const existing = existingSighting.data()!;
        await historyRef.set(
          {
            ...historyPayload,
            sightingCount: (existing.sightingCount || 1) + 1,
          },
          { merge: true },
        );
      } else {
        await historyRef.set({
          icao: pending.icao.toLowerCase(),
          firstSeen: now,
          sightingCount: 1,
          ...historyPayload,
        });
      }
    }
  }

  return updatedLastNotified;
}
