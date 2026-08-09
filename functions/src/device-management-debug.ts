import { JsonDocumentStore } from './json-document-store';
import { onRequest } from './on-request';
import { logger } from './pi-logger';
import type { DeviceRegistration } from './types';
import { DEVICE_COLLECTION, FRONTEND_BASE_URL } from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import { getPushoverApiToken } from './utils';

export function createDeviceDebugHandlers(db: JsonDocumentStore) {
  const debugListTokens = onRequest(
    { region: 'europe-west3' },
    async (req: any, res: any) => {
      const secret = process.env.DEBUG_TOKEN_SECRET;
      if (!secret || req.query.secret !== secret) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const snapshot = await db.collection(DEVICE_COLLECTION).get();
      const tokens = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        data: doc.data(),
      }));

      res.json({ count: tokens.length, tokens });
    },
  );

  const debugSendToken = onRequest(
    { region: 'europe-west3' },
    async (req: any, res: any) => {
      const secret = process.env.DEBUG_TOKEN_SECRET;
      if (!secret || req.query.secret !== secret) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const userKey = req.query.userKey as string | undefined;
      if (!userKey) {
        res.status(400).json({ error: 'userKey query param required' });
        return;
      }

      const snapshot = await db
        .collection(DEVICE_COLLECTION)
        .doc(userKey)
        .get();
      if (!snapshot.exists) {
        res.status(404).json({ error: 'user not found' });
        return;
      }

      const data = snapshot.data() as unknown as DeviceRegistration;
      res.json({
        userKey,
        pushoverUserKey: data.pushoverUserKey,
      });
    },
  );

  const testProximityTargeting = onRequest(
    { region: 'europe-west3' },
    async (req: any, res: any) => {
      applyCors(res, 'GET, OPTIONS');
      if (handleOptionsPreflight(req, res)) {
        return;
      }

      const PUSHOVER_API_TOKEN = getPushoverApiToken();

      try {
        const snapshot = await db.collection(DEVICE_COLLECTION).get();
        const results: any[] = [];

        for (const doc of snapshot.docs) {
          const data = doc.data() as unknown as DeviceRegistration;
          const deviceInfo: any = {
            deviceName: data.deviceName || doc.id,
            userKey: data.pushoverUserKey?.slice(0, 10) + '...',
            proximityEnabled: data.notifyProximity,
          };

          if (data.notifyProximity === true && data.pushoverUserKey) {
            const params = {
              token: PUSHOVER_API_TOKEN || '',
              user: data.pushoverUserKey,
              device: data.deviceName || '',
              title: '✈️ TEST: Proximity Alert',
              message:
                'This is a test proximity notification to verify device targeting is working correctly.',
              url: `${FRONTEND_BASE_URL}/`,
              url_title: 'View App',
              priority: '1',
              sound: 'none',
            };

            const response = await fetch(
              'https://api.pushover.net/1/messages.json',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(params as any),
              } as any,
            );

            const result: any = await response.json();
            deviceInfo.sent = response.ok && result.status === 1;
            deviceInfo.response = result;
          } else {
            deviceInfo.sent = false;
            deviceInfo.reason = 'proximity disabled';
          }

          results.push(deviceInfo);
        }

        res.json({ success: true, results });
      } catch (error: any) {
        logger.error('testProximityTargeting error', error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  return {
    debugListTokens,
    debugSendToken,
    testProximityTargeting,
  };
}
