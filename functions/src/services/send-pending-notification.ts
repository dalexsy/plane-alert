import { JsonDocumentReference } from './json-document-store-refs';
import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
import type { DeviceRegistration } from '../types';
import { MILITARY_HISTORY_COLLECTION } from '../constants';
import { releaseNotificationClaim } from './notification-cooldown';
import { sendPushoverNotification } from './pushover-client';
import { recordPushoverSend } from './pushover-send-ledger';
import { playKioskAlertSound } from './kiosk-alert-sound';
import { ackKioskInRange, isKioskInRangeAcked } from './kiosk-in-range-edge-state';
import {
  isExpiredSubscriptionError,
  sendPlanesWebPush,
} from './web-push-send';
import {
  canDeliverPushover,
  notificationAccountKey,
  resolveDeliveryChannels,
  type DeliveryChannel,
} from './notification-delivery';
import type { PendingNotification } from './notification-types';

export async function sendPendingNotification(
  db: JsonDocumentStore,
  deviceRef: JsonDocumentReference,
  docId: string,
  data: DeviceRegistration,
  cooldownDeviceName: string,
  pending: PendingNotification,
  now: number,
  registeredPushoverDevices?: Set<string> | null,
): Promise<boolean> {
  const accountKey = notificationAccountKey(data, docId);
  if (!accountKey) {
    return false;
  }

  const channels = resolveDeliveryChannels(
    data,
    registeredPushoverDevices,
    docId,
  );
  if (!channels.length) {
    return false;
  }

  let delivered = false;
  let lastChannel: DeliveryChannel | null = null;

  for (const channel of channels) {
    if (channel === 'pwa') {
      const sub = data.webPushSubscription;
      if (!sub) continue;
      try {
        const ok = await sendPlanesWebPush(sub, {
          title: pending.message.title,
          body: pending.message.message,
          url: pending.message.url || '',
          icon: pending.message.icon,
          tag: pending.icao,
        });
        if (ok) {
          delivered = true;
          lastChannel = 'pwa';
          break;
        }
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await deviceRef.set({ webPushSubscription: null }, { merge: true });
          data.webPushSubscription = undefined;
          logger.info('Cleared expired web push subscription', { docId });
        }
      }
      continue;
    }

    if (channel === 'pushover') {
      const sent = await sendPushoverNotification(
        data.pushoverUserKey!,
        pending.deviceName,
        pending.message,
        docId,
      );
      if (sent) {
        delivered = true;
        lastChannel = 'pushover';
        break;
      }
    }
  }

  if (
    !delivered &&
    data.pushoverFallbackEnabled === true &&
    canDeliverPushover(data, registeredPushoverDevices) &&
    data.pushoverUserKey?.trim()
  ) {
    const sent = await sendPushoverNotification(
      data.pushoverUserKey!,
      pending.deviceName,
      pending.message,
      docId,
    );
    if (sent) {
      delivered = true;
      lastChannel = 'pushover';
    }
  }

  if (!delivered) {
    await releaseNotificationClaim(db, accountKey, cooldownDeviceName, pending.icao);
    return false;
  }

  logger.info('Notification delivered', {
    docId,
    icao: pending.icao,
    channel: lastChannel,
  });

  if (pending.playKioskAlert && !isKioskInRangeAcked(pending.icao)) {
    playKioskAlertSound(pending.icao, 'military-pushover', {
      model: pending.model,
      onPlayed: () => ackKioskInRange(pending.icao),
    });
  }

  await recordPushoverSend(db, pending.icao);
  await writeMilitaryHistory(db, accountKey, data, pending, now);
  return true;
}

async function writeMilitaryHistory(
  db: JsonDocumentStore,
  accountKey: string,
  data: DeviceRegistration,
  pending: PendingNotification,
  now: number,
): Promise<void> {
  if (
    !pending.message.hex ||
    pending.message.title.startsWith('✈️ Plane Nearby')
  ) {
    return;
  }

  const historyDocId = `${accountKey}__${pending.icao.toLowerCase()}`;
  const historyRef = db.collection(MILITARY_HISTORY_COLLECTION).doc(historyDocId);
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
