import { JsonDocumentStore } from './json-document-store';
import { onRequest } from './on-request';
import { logger } from './pi-logger';
import { FieldValue } from './document-fields';
import type { DeviceRegistration, Location, WebPushSubscription } from './types';
import { DEVICE_COLLECTION } from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import { clampRadius } from './utils';
import { getPlanesVapidPublicKey } from './services/planes-vapid';
import { linkPushoverDocToInstallation } from './services/link-pushover-installation';

function pwaDocId(installationId: string): string {
  return `pwa_${installationId.trim()}`;
}

function parseSubscription(raw: unknown): WebPushSubscription | null {
  if (!raw || typeof raw !== 'object') return null;
  const sub = raw as WebPushSubscription;
  const endpoint = sub.endpoint?.trim();
  const p256dh = sub.keys?.p256dh?.trim();
  const auth = sub.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export function createPwaPushHandlers(db: JsonDocumentStore) {
  const vapidPublicKey = onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyCors(res, 'GET, OPTIONS');
    if (handleOptionsPreflight(req, res)) return;
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const key = getPlanesVapidPublicKey();
    if (!key) {
      res.status(503).json({ error: 'web_push_unavailable' });
      return;
    }
    res.status(200).json({ publicKey: key });
  });

  const registerPwaAlerts = onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyCors(res, 'POST, OPTIONS');
    if (handleOptionsPreflight(req, res)) return;
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const body = req.body as {
        installationId?: string;
        location?: Location;
        webPushSubscription?: unknown;
        pwaNotificationsEnabled?: boolean;
        distanceUnit?: 'km' | 'miles';
        radiusKm?: number;
        timezone?: string;
        ignoredTypes?: string[];
        platform?: string;
        clientModel?: string;
        pushoverUserKey?: string;
        pushoverDeviceName?: string;
        pushoverFallbackEnabled?: boolean;
        confirmWebPushChannel?: boolean;
        preferPushoverChannel?: boolean;
      };
      const installationId = body.installationId?.trim();
      if (!installationId || installationId.length < 8) {
        res.status(400).json({ error: 'installationId is required' });
        return;
      }
      const location = body.location;
      if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
        res.status(400).json({ error: 'location with lat/lon is required' });
        return;
      }
      const enabled = body.pwaNotificationsEnabled !== false;
      const subscription = enabled ? parseSubscription(body.webPushSubscription) : null;
      if (enabled && !subscription) {
        res.status(400).json({ error: 'webPushSubscription is required when enabled' });
        return;
      }
      const pushoverUserKey = body.pushoverUserKey?.trim();
      const pushoverDeviceName = body.pushoverDeviceName?.trim();
      const pushoverFallbackEnabled =
        body.pushoverFallbackEnabled === true &&
        Boolean(pushoverUserKey && pushoverDeviceName);

      const docId = pwaDocId(installationId);
      const ref = db.collection(DEVICE_COLLECTION).doc(docId);
      const existing = await ref.get();
      const existingData = existing.exists
        ? (existing.data() as unknown as DeviceRegistration)
        : undefined;

      const payload: DeviceRegistration = {
        installationId,
        pwaNotificationsEnabled: enabled,
        ...(subscription ? { webPushSubscription: subscription } : {}),
        ...(pushoverFallbackEnabled
          ? {
              pushoverUserKey,
              deviceName: pushoverDeviceName,
              pushoverFallbackEnabled: true,
            }
          : {}),
        platform: body.platform,
        deviceName: pushoverDeviceName || `pwa-${installationId.slice(0, 8)}`,
        distanceUnit: body.distanceUnit === 'miles' ? 'miles' : 'km',
        radiusKm: clampRadius(body.radiusKm),
        timezone: body.timezone,
        location,
        ignoredTypes: Array.isArray(body.ignoredTypes) ? body.ignoredTypes : [],
        notifyProximity: false,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (body.preferPushoverChannel === true) {
        payload.deliveryChannelPreference = 'pushover';
        payload.webPushChannelConfirmedAt = undefined;
      } else if (body.confirmWebPushChannel === true) {
        payload.deliveryChannelPreference = 'pwa';
        payload.webPushChannelConfirmedAt = Date.now();
      } else if (existingData?.deliveryChannelPreference) {
        payload.deliveryChannelPreference = existingData.deliveryChannelPreference;
        if (existingData.webPushChannelConfirmedAt) {
          payload.webPushChannelConfirmedAt = existingData.webPushChannelConfirmedAt;
        }
      }

      if (!existing.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }
      await ref.set(payload, { merge: true });
      if (enabled && installationId) {
        await linkPushoverDocToInstallation(
          db,
          installationId,
          pushoverUserKey,
          pushoverDeviceName,
        );
      }
      logger.info('registerPwaAlerts success', {
        docId,
        enabled,
        hasSubscription: Boolean(subscription),
      });
      res.status(200).json({ success: true, docId, enabled });
    } catch (error: unknown) {
      logger.error('registerPwaAlerts failed', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return { vapidPublicKey, registerPwaAlerts };
}
