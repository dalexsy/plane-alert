import { LocalFirestore } from './local-firestore';
import { onRequest } from './on-request';
import { logger } from './pi-logger';
import * as admin from './admin-compat';
import type { DeviceRegistration, Location } from './types';
import { DEVICE_COLLECTION } from './constants';
import { applyCors, handleOptionsPreflight } from './http';
import {
  sanitizeDeviceName,
  getDeviceDocId,
  clampRadius,
  validatePushoverUserKey,
} from './utils';
import { pruneOrphanDeviceRegistrations } from './services/prune-orphan-registrations';
import { resolveRegistrationDeviceName } from './services/resolve-registration-device-name';

export function createRegisterDeviceHandler(db: LocalFirestore) {
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
          clientModel,
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
          clientModel?: string;
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

        if (
          !location ||
          typeof location.lat !== 'number' ||
          typeof location.lon !== 'number'
        ) {
          res.status(400).json({ error: 'location with lat/lon is required' });
          return;
        }

        const validation = await validatePushoverUserKey(pushoverUserKey);
        if (!validation.valid || !validation.devices.length) {
          res.status(400).json({
            error: 'Invalid Pushover user key or no devices on account',
            availableDevices: validation.devices,
          });
          return;
        }

        const pushoverDeviceName = resolveRegistrationDeviceName(
          deviceName,
          platform,
          clientModel,
          validation.devices,
        );

        if (!pushoverDeviceName) {
          res.status(200).json({
            success: false,
            skipped: true,
            reason: 'no_matching_pushover_device',
            availableDevices: validation.devices,
          });
          return;
        }

        const deviceSlug = sanitizeDeviceName(pushoverDeviceName);
        const docId = getDeviceDocId(pushoverUserKey, pushoverDeviceName);
        const deviceRef = db.collection(DEVICE_COLLECTION).doc(docId);
        const existing = await deviceRef.get();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        const existingData = existing.exists
          ? (existing.data() as unknown as DeviceRegistration)
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
          deviceName: pushoverDeviceName,
          deviceSlug,
          updatedAt: timestamp as any,
        };

        const payload: Record<string, any> = {
          ...doc,
        };

        if (
          !existing.exists ||
          !(existing.data() as unknown as DeviceRegistration)?.createdAt
        ) {
          payload.createdAt = timestamp;
        }

        await deviceRef.set(payload, { merge: true });

        const pruned = await pruneOrphanDeviceRegistrations(
          db,
          pushoverUserKey,
          validation.devices,
        );

        logger.info('registerDevice success', {
          userKey: pushoverUserKey.slice(0, 8),
          deviceName: pushoverDeviceName,
          pruned,
        });

        res.status(200).json({
          success: true,
          deviceId: deviceRef.id,
          deviceName: pushoverDeviceName,
          deviceSlug,
          prunedOrphans: pruned,
          availableDevices: validation.devices,
        });
      } catch (error: any) {
        logger.error('registerDevice failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );
}
