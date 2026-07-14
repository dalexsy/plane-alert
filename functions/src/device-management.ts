import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration } from './types';
import { DEVICE_COLLECTION } from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import {
  validatePushoverUserKey,
} from './utils';
import { createDeviceDebugHandlers } from './device-management-debug';
import {
  buildCheckDeviceEntries,
  fetchDeviceDocsForUserKey,
  formatListAllDeviceEntry,
  markPushoverRegistration,
} from './services/device-list-formatting';
import { createRegisterDeviceHandler } from './device-management-register';

export function createDeviceManagementFunctions(db: admin.firestore.Firestore) {
  const registerDevice = createRegisterDeviceHandler(db);

  const checkDevice = onRequest(
    { region: 'europe-west3' },
    async (req, res) => {
      applyCors(res, 'POST, OPTIONS');
      if (handleOptionsPreflight(req, res)) {
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const { pushoverUserKey } = req.body as { pushoverUserKey?: string };

        if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
          res.status(400).json({ error: 'pushoverUserKey is required' });
          return;
        }

        logger.info('checkDevice called', {
          userKey: pushoverUserKey.slice(0, 8),
        });

        const snapshotDocs = await fetchDeviceDocsForUserKey(
          db,
          pushoverUserKey,
        );
        const deviceEntries = await buildCheckDeviceEntries(snapshotDocs);

        const validation = await validatePushoverUserKey(pushoverUserKey);
        const keyValid = validation.valid || deviceEntries.length > 0;
        const availableDevices = markPushoverRegistration(
          deviceEntries,
          validation.devices,
        );

        logger.info('checkDevice success', {
          userKey: pushoverUserKey.slice(0, 8),
          deviceCount: deviceEntries.length,
        });

        res.status(200).json({
          registered: deviceEntries.length > 0,
          keyValid,
          devices: deviceEntries,
          availableDevices,
        });
      } catch (error: any) {
        logger.error('checkDevice failed', {
          error: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
        res
          .status(500)
          .json({ error: 'Internal error', details: error?.message });
      }
    },
  );

  const listAllDevices = onRequest(
    { region: 'europe-west3' },
    async (req, res) => {
      applyCors(res, 'GET, OPTIONS');
      if (handleOptionsPreflight(req, res)) {
        return;
      }

      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const snapshot = await db.collection(DEVICE_COLLECTION).get();

        const devices = await Promise.all(
          snapshot.docs.map((doc) =>
            formatListAllDeviceEntry(doc, doc.data() as DeviceRegistration),
          ),
        );

        res.status(200).json({
          count: devices.length,
          devices,
        });
      } catch (error: any) {
        logger.error('listAllDevices failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );

  const unsubscribeDevice = onRequest(
    { region: 'europe-west3' },
    async (req, res) => {
      applyCors(res, 'POST, DELETE, OPTIONS');
      if (handleOptionsPreflight(req, res)) {
        return;
      }

      if (req.method !== 'POST' && req.method !== 'DELETE') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const { pushoverUserKey, deviceId } = req.body as {
          pushoverUserKey?: string;
          deviceId?: string;
        };

        const docId = deviceId || pushoverUserKey;

        if (!docId || typeof docId !== 'string') {
          res
            .status(400)
            .json({ error: 'pushoverUserKey or deviceId is required' });
          return;
        }

        await db.collection(DEVICE_COLLECTION).doc(docId).delete();

        logger.info('Device unsubscribed', {
          docId: docId.slice(0, 8),
        });

        res
          .status(200)
          .json({ success: true, message: 'Unsubscribed successfully' });
      } catch (error: any) {
        logger.error('unsubscribeDevice failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );

  const debugHandlers = createDeviceDebugHandlers(db);

  return {
    registerDevice,
    checkDevice,
    listAllDevices,
    unsubscribeDevice,
    ...debugHandlers,
  };
}

