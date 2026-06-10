import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DeviceRegistration, Location } from './types';
import { DEVICE_COLLECTION } from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import { sanitizeDeviceName, getDeviceDocId, clampRadius } from './utils';

export function createRegisterDeviceHandler(db: admin.firestore.Firestore) {
  return onRequest(
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

        const existingData = existing.exists
          ? (existing.data() as DeviceRegistration)
          : undefined;
        const existingLocation =
          existingData?.location || (existingData as any)?.home;
        const isSameLocation =
          !!existingLocation &&
          typeof existingLocation.lat === 'number' &&
          typeof existingLocation.lon === 'number' &&
          Math.abs(existingLocation.lat - location.lat) < 0.000001 &&
          Math.abs(existingLocation.lon - location.lon) < 0.000001;
        const normalizedLocation: Location = {
          lat: location.lat,
          lon: location.lon,
          ...(location.address && location.address.trim()
            ? { address: location.address.trim() }
            : isSameLocation && existingLocation?.address
              ? { address: existingLocation.address }
              : {}),
        };

        const doc: DeviceRegistration = {
          pushoverUserKey,
          platform,
          distanceUnit: distanceUnit === 'miles' ? 'miles' : 'km',
          radiusKm: clampRadius(radiusKm),
          timezone,
          location: normalizedLocation,
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
    },
  );
}
