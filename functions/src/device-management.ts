import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration, Location } from './types';
import { DEVICE_COLLECTION } from './constants';
import {
  sanitizeDeviceName,
  getDeviceDocId,
  inferDeviceName,
  validatePushoverUserKey,
  clampRadius,
} from './utils';

export function createDeviceManagementFunctions(db: admin.firestore.Firestore) {
  const registerDevice = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const {
        pushoverUserKey,
        platform,
        distanceUnit,
        radiusKm,
        timezone,
        location,
        specialIcaos,
        notifyProximity,
        deviceName,
        ignoredTypes,
      } = req.body as {
        pushoverUserKey?: string;
        platform?: string;
        distanceUnit?: 'km' | 'miles';
        radiusKm?: number;
        timezone?: string;
        location?: Location;
        specialIcaos?: string[];
        notifyProximity?: boolean;
        deviceName?: string;
        ignoredTypes?: string[];
      };

      if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
        res.status(400).json({ error: 'pushoverUserKey is required' });
        return;
      }

      if (!deviceName || typeof deviceName !== 'string') {
        res.status(400).json({ error: 'deviceName is required' });
        return;
      }

      const normalizedDeviceName = deviceName.trim();
      if (!normalizedDeviceName) {
        res.status(400).json({ error: 'deviceName must not be empty' });
        return;
      }

      if (
        !location ||
        typeof location.lat !== 'number' ||
        typeof location.lon !== 'number'
      ) {
        res.status(400).json({ error: 'location with lat/lon is required' });
        return;
      }

      const deviceSlug = sanitizeDeviceName(normalizedDeviceName);
      const docId = getDeviceDocId(pushoverUserKey, normalizedDeviceName);
      const deviceRef = db.collection(DEVICE_COLLECTION).doc(docId);
      const existing = await deviceRef.get();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      const doc: DeviceRegistration = {
        pushoverUserKey,
        platform,
        distanceUnit: distanceUnit === 'miles' ? 'miles' : 'km',
        radiusKm: clampRadius(radiusKm),
        timezone,
        location,
        specialIcaos: Array.isArray(specialIcaos) ? specialIcaos : [],
        notifyProximity: notifyProximity === true,
        ignoredTypes: Array.isArray(ignoredTypes) ? ignoredTypes : [],
        deviceName: normalizedDeviceName,
        deviceSlug,
        updatedAt: timestamp as any,
      };

      const payload: Record<string, any> = {
        ...doc,
      };

      if (
        !existing.exists ||
        !(existing.data() as DeviceRegistration)?.createdAt
      ) {
        payload.createdAt = timestamp;
      }

      await deviceRef.set(payload, { merge: true });

      res.status(200).json({
        success: true,
        deviceId: deviceRef.id,
        deviceName: normalizedDeviceName,
        deviceSlug,
      });
    } catch (error: any) {
      logger.error('registerDevice failed', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  const checkDevice = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
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

      const collectionRef = db.collection(DEVICE_COLLECTION);
      const prefix = `${pushoverUserKey}__`;
      const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

      const [fieldMatchSnapshot, prefixSnapshot, legacyDoc] = await Promise.all(
        [
          collectionRef.where('pushoverUserKey', '==', pushoverUserKey).get(),
          collectionRef
            .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
            .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
            .get(),
          collectionRef.doc(pushoverUserKey).get(),
        ]
      );

      const snapshotDocs = new Map<
        string,
        FirebaseFirestore.DocumentSnapshot
      >();

      for (const doc of fieldMatchSnapshot.docs) {
        snapshotDocs.set(doc.id, doc);
      }

      for (const doc of prefixSnapshot.docs) {
        snapshotDocs.set(doc.id, doc);
      }

      if (legacyDoc.exists) {
        snapshotDocs.set(legacyDoc.id, legacyDoc);
      }

      const deviceEntries: Array<{
        deviceId: string;
        deviceName: string;
        platform?: string;
        config: {
          radiusKm?: number;
          distanceUnit?: 'km' | 'miles';
          notifyProximity?: boolean;
          ignoredTypes?: string[];
          location?: Location;
          createdAt?: any;
          updatedAt?: any;
        };
      }> = [];

      for (const doc of snapshotDocs.values()) {
        const data = doc.data() as DeviceRegistration;
        const deviceName = inferDeviceName(doc.id, data);

        if (!data.deviceName || data.deviceName !== deviceName) {
          await doc.ref.set(
            {
              deviceName,
              deviceSlug: sanitizeDeviceName(deviceName),
            },
            { merge: true }
          );
        }

        deviceEntries.push({
          deviceId: doc.id,
          deviceName,
          platform: data.platform,
          config: {
            radiusKm: data.radiusKm,
            distanceUnit: data.distanceUnit,
            notifyProximity: data.notifyProximity,
            ignoredTypes: data.ignoredTypes,
            location: data.location || (data as any).home, // Support legacy 'home' field
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        });
      }

      const validation = await validatePushoverUserKey(pushoverUserKey);
      const keyValid = validation.valid || deviceEntries.length > 0;

      // Only use Pushover-registered devices as the source of truth for available devices
      // This prevents showing devices in the UI that can't actually receive notifications
      const pushoverDevices = new Set<string>(
        validation.devices
          .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
          .map((name) => name.trim().toLowerCase())
      );

      // Mark each device entry with whether it's registered in Pushover
      for (const entry of deviceEntries) {
        (entry as any).isRegisteredInPushover = pushoverDevices.has(entry.deviceName.toLowerCase());
      }

      // Only include Pushover-registered devices as available
      const availableDevices = validation.devices
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
        .map((name) => name.trim())
        .sort((a, b) => a.localeCompare(b));

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
  });

  const listAllDevices = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // List ALL registered devices from Firebase
      const snapshot = await db.collection(DEVICE_COLLECTION).get();

      const devices = snapshot.docs.map((doc) => {
        const data = doc.data() as DeviceRegistration;
        const deviceName = inferDeviceName(doc.id, data);
        if (!data.deviceName || data.deviceName !== deviceName) {
          doc.ref
            .set(
              {
                deviceName,
                deviceSlug: sanitizeDeviceName(deviceName),
              },
              { merge: true }
            )
            .catch((error: any) =>
              logger.warn('Failed to backfill device metadata', {
                docId: doc.id,
                error: error?.message,
              })
            );
        }

        const keySource = data.pushoverUserKey || doc.id;
        const maskedKey =
          keySource.length > 12
            ? `${keySource.substring(0, 8)}...${keySource.substring(
                keySource.length - 4
              )}`
            : keySource;

        // Support both new 'location' and legacy 'home' field
        const deviceLocation = data.location || (data as any).home;
        const hasLocation =
          deviceLocation &&
          typeof deviceLocation.lat === 'number' &&
          typeof deviceLocation.lon === 'number';

        let location = 'Unknown';
        if (hasLocation) {
          const lat = Number(deviceLocation?.lat ?? 0);
          const lon = Number(deviceLocation?.lon ?? 0);
          location = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }

        return {
          id: doc.id,
          deviceName,
          deviceSlug: data.deviceSlug || sanitizeDeviceName(deviceName),
          pushoverUserKey: maskedKey,
          platform: data.platform || 'unknown',
          distanceUnit: data.distanceUnit || 'km',
          radiusKm: data.radiusKm || 100,
          notifyProximity: data.notifyProximity || false,
          location,
          address: deviceLocation?.address || '',
          ignoredTypesCount: data.ignoredTypes?.length || 0,
          specialIcaosCount: data.specialIcaos?.length || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      res.status(200).json({
        count: devices.length,
        devices,
      });
    } catch (error: any) {
      logger.error('listAllDevices failed', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  const unsubscribeDevice = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { pushoverUserKey, deviceId } = req.body as {
        pushoverUserKey?: string;
        deviceId?: string; // Allow deleting by specific device ID
      };

      // Support both: delete by pushoverUserKey (current device) or deviceId (any device)
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
  });

  const debugListTokens = onRequest(async (req: any, res: any) => {
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
  });

  const debugSendToken = onRequest(async (req: any, res: any) => {
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

    const snapshot = await db.collection(DEVICE_COLLECTION).doc(userKey).get();
    if (!snapshot.exists) {
      res.status(404).json({ error: 'user not found' });
      return;
    }

    const data = snapshot.data() as DeviceRegistration;
    res.json({
      userKey,
      pushoverUserKey: data.pushoverUserKey,
    });
  });

  const testProximityTargeting = onRequest(async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');

    const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

    try {
      const snapshot = await db.collection(DEVICE_COLLECTION).get();
      const results: any[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data() as DeviceRegistration;
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
            url: 'https://plane-alert.surge.sh/',
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
            } as any
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
  });

  return {
    registerDevice,
    checkDevice,
    listAllDevices,
    unsubscribeDevice,
    debugListTokens,
    debugSendToken,
    testProximityTargeting,
  };
}
