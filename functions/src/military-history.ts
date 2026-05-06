import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  COOLDOWN_COLLECTION,
  DEVICE_COLLECTION,
  MILITARY_HISTORY_COLLECTION,
} from './constants';
import { sanitizeDeviceName, validatePushoverUserKey } from './utils';
import type { DeviceRegistration } from './types';

export interface MilitaryHistorySighting {
  icao: string;
  callsign?: string;
  model?: string;
  operator?: string;
  country?: string;
  registration?: string;
  notificationDelivered?: boolean;
  notifiedDeviceName?: string;
  notifiedDeviceCount?: number;
  notifiedDeviceNames?: string[];
  notificationLocation?: {
    lat: number;
    lon: number;
    address?: string;
  };
  firstSeen: number;
  lastSeen: number;
  sightingCount: number;
  lat?: number;
  lon?: number;
  altitude?: number;
  bearing?: number;
  cardinal?: string;
}

interface NotificationCooldownRecord {
  docId: string;
  icao: string;
  deviceName?: string;
  lastSent: number;
}

interface LocationGroup {
  key: string;
  lastSent: number;
  deviceNames: Set<string>;
  location?: {
    lat: number;
    lon: number;
    address?: string;
  };
}

function buildLocationKey(
  location?: { lat: number; lon: number; address?: string },
  fallback?: string,
): string {
  if (location) {
    return `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
  }

  return fallback || 'unknown';
}

function parseCooldownDocId(
  userKey: string,
  docId: string,
): NotificationCooldownRecord | null {
  if (!docId.startsWith(`${userKey}__`)) {
    return null;
  }

  const suffix = docId.slice(userKey.length + 2);
  const parts = suffix.split('__').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const lastPart = parts[parts.length - 1];
  if (!lastPart || lastPart.toLowerCase().startsWith('proximity_')) {
    return null;
  }

  return {
    docId,
    icao: lastPart.toLowerCase(),
    deviceName: parts.length > 1 ? parts.slice(0, -1).join('__') : undefined,
    lastSent: 0,
  };
}

export function createMilitaryHistoryFunctions(db: admin.firestore.Firestore) {
  /**
   * Save a military plane sighting
   * Creates or updates existing record per pushover key
   */
  const saveMilitarySighting = onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
      region: 'europe-west3',
    },
    async (req, res) => {
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
          icao,
          callsign,
          model,
          operator,
          country,
          registration,
          notifiedDeviceName,
          notificationLocation,
          lat,
          lon,
          altitude,
          bearing,
          cardinal,
        } = req.body as {
          pushoverUserKey?: string;
          icao?: string;
          callsign?: string;
          model?: string;
          operator?: string;
          country?: string;
          registration?: string;
          notifiedDeviceName?: string;
          notificationLocation?: {
            lat: number;
            lon: number;
            address?: string;
          };
          lat?: number;
          lon?: number;
          altitude?: number;
          bearing?: number;
          cardinal?: string;
        };

        if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
          res.status(400).json({ error: 'pushoverUserKey is required' });
          return;
        }

        if (!icao || typeof icao !== 'string') {
          res.status(400).json({ error: 'icao is required' });
          return;
        }

        // Document ID: pushoverKey__icao (ensures uniqueness per user per aircraft)
        const docId = `${pushoverUserKey}__${icao.toLowerCase()}`;
        const docRef = db.collection(MILITARY_HISTORY_COLLECTION).doc(docId);
        const existing = await docRef.get();

        const now = Date.now();

        if (existing.exists) {
          // Update existing record
          const data = existing.data() as MilitaryHistorySighting;
          await docRef.update({
            lastSeen: now,
            sightingCount: (data.sightingCount || 1) + 1,
            // Update latest position if provided
            ...(lat != null && { lat }),
            ...(lon != null && { lon }),
            ...(altitude != null && { altitude }),
            ...(bearing != null && { bearing }),
            ...(cardinal && { cardinal }),
            // Update metadata if changed
            ...(callsign && { callsign }),
            ...(model && { model }),
            ...(operator && { operator }),
            ...(country && { country }),
            ...(registration && { registration }),
            ...(notifiedDeviceName && { notifiedDeviceName }),
            ...(notificationLocation && { notificationLocation }),
          });
        } else {
          // Create new record
          const newSighting: MilitaryHistorySighting = {
            icao: icao.toLowerCase(),
            firstSeen: now,
            lastSeen: now,
            sightingCount: 1,
            notificationDelivered: false,
            ...(callsign && { callsign }),
            ...(model && { model }),
            ...(operator && { operator }),
            ...(country && { country }),
            ...(registration && { registration }),
            ...(notifiedDeviceName && { notifiedDeviceName }),
            ...(notificationLocation && { notificationLocation }),
            ...(lat != null && { lat }),
            ...(lon != null && { lon }),
            ...(altitude != null && { altitude }),
            ...(bearing != null && { bearing }),
            ...(cardinal && { cardinal }),
          };
          await docRef.set(newSighting);
        }

        logger.info('Military sighting saved', {
          pushoverUserKey: pushoverUserKey.slice(0, 8),
          icao,
          model,
        });

        res.status(200).json({ success: true });
      } catch (error: any) {
        logger.error('saveMilitarySighting failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );

  /**
   * Get military sighting history for a pushover key
   */
  const getMilitaryHistory = onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
      region: 'europe-west3',
    },
    async (req, res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      try {
        const pushoverUserKey =
          req.method === 'GET'
            ? (req.query.pushoverUserKey as string)
            : (req.body as any)?.pushoverUserKey;

        if (!pushoverUserKey || typeof pushoverUserKey !== 'string') {
          res.status(400).json({ error: 'pushoverUserKey is required' });
          return;
        }

        const prefix = `${pushoverUserKey}__`;
        const prefixEnd = `${prefix}${String.fromCharCode(0xf8ff)}`;

        const [historySnapshot, cooldownSnapshot, deviceSnapshot, validation] =
          await Promise.all([
            db
              .collection(MILITARY_HISTORY_COLLECTION)
              .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
              .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
              .get(),
            db
              .collection(COOLDOWN_COLLECTION)
              .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
              .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
              .get(),
            db
              .collection(DEVICE_COLLECTION)
              .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
              .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
              .get(),
            validatePushoverUserKey(pushoverUserKey),
          ]);

        const registeredDeviceSlugs = new Set(
          validation.devices.map((deviceName) => sanitizeDeviceName(deviceName)),
        );

        const historyByIcao = new Map<string, MilitaryHistorySighting>();
        for (const doc of historySnapshot.docs) {
          const entry = doc.data() as MilitaryHistorySighting;
          if (entry?.icao) {
            historyByIcao.set(entry.icao.toLowerCase(), entry);
          }
        }

        const deviceBySlug = new Map<string, DeviceRegistration>();
        for (const doc of deviceSnapshot.docs) {
          const entry = doc.data() as DeviceRegistration;
          const deviceName = entry.deviceName || entry.deviceSlug;
          if (deviceName) {
            deviceBySlug.set(sanitizeDeviceName(deviceName), entry);
          }
        }

        const cooldownsByIcao = new Map<string, NotificationCooldownRecord[]>();
        for (const doc of cooldownSnapshot.docs) {
          const parsed = parseCooldownDocId(pushoverUserKey, doc.id);
          if (!parsed) {
            continue;
          }

          if (
            parsed.deviceName &&
            registeredDeviceSlugs.size > 0 &&
            !registeredDeviceSlugs.has(sanitizeDeviceName(parsed.deviceName))
          ) {
            continue;
          }

          const data = doc.data() as { lastSent?: number };
          parsed.lastSent = typeof data.lastSent === 'number' ? data.lastSent : 0;
          if (!parsed.lastSent) {
            continue;
          }

          const existing = cooldownsByIcao.get(parsed.icao) ?? [];
          existing.push(parsed);
          cooldownsByIcao.set(parsed.icao, existing);
        }

        const history: MilitaryHistorySighting[] = Array.from(
          cooldownsByIcao.entries(),
        ).map(([icao, cooldowns]) => {
          const matchingHistory = historyByIcao.get(icao);
          const locationGroups = new Map<string, LocationGroup>();

          for (const cooldown of cooldowns) {
            const matchingDevice = cooldown.deviceName
              ? deviceBySlug.get(sanitizeDeviceName(cooldown.deviceName))
              : undefined;
            const location = matchingDevice?.location;
            const groupKey = buildLocationKey(location, cooldown.deviceName);
            const existingGroup = locationGroups.get(groupKey);

            if (existingGroup) {
              existingGroup.lastSent = Math.max(existingGroup.lastSent, cooldown.lastSent);
              if (cooldown.deviceName) {
                existingGroup.deviceNames.add(cooldown.deviceName);
              }
              if (!existingGroup.location && location) {
                existingGroup.location = {
                  lat: location.lat,
                  lon: location.lon,
                  ...(location.address && { address: location.address }),
                };
              }
              continue;
            }

            locationGroups.set(groupKey, {
              key: groupKey,
              lastSent: cooldown.lastSent,
              deviceNames: new Set(cooldown.deviceName ? [cooldown.deviceName] : []),
              location: location
                ? {
                    lat: location.lat,
                    lon: location.lon,
                    ...(location.address && { address: location.address }),
                  }
                : undefined,
            });
          }

          const sortedGroups = Array.from(locationGroups.values()).sort(
            (a, b) => b.lastSent - a.lastSent,
          );
          const latestGroup = sortedGroups[0];
          const matchingLocation =
            matchingHistory?.notificationLocation || latestGroup?.location;
          const groupedDeviceNames = latestGroup
            ? Array.from(latestGroup.deviceNames).sort((a, b) =>
                a.localeCompare(b),
              )
            : [];

          return {
            icao,
            firstSeen:
              matchingHistory?.firstSeen ||
              sortedGroups[sortedGroups.length - 1].lastSent,
            lastSeen: latestGroup?.lastSent || matchingHistory?.lastSeen || 0,
            sightingCount: sortedGroups.length,
            notificationDelivered: true,
            notifiedDeviceName:
              groupedDeviceNames.length === 1
                ? groupedDeviceNames[0]
                : groupedDeviceNames.length === 0
                  ? matchingHistory?.notifiedDeviceName
                  : undefined,
            notifiedDeviceCount: groupedDeviceNames.length || undefined,
            ...(groupedDeviceNames.length > 0 && {
              notifiedDeviceNames: groupedDeviceNames,
            }),
            ...(matchingLocation && {
              notificationLocation: {
                lat: matchingLocation.lat,
                lon: matchingLocation.lon,
                ...(matchingLocation.address && {
                  address: matchingLocation.address,
                }),
              },
            }),
            ...(matchingHistory?.callsign && { callsign: matchingHistory.callsign }),
            ...(matchingHistory?.model && { model: matchingHistory.model }),
            ...(matchingHistory?.operator && { operator: matchingHistory.operator }),
            ...(matchingHistory?.country && { country: matchingHistory.country }),
            ...(matchingHistory?.registration && {
              registration: matchingHistory.registration,
            }),
            ...(matchingHistory?.lat != null && { lat: matchingHistory.lat }),
            ...(matchingHistory?.lon != null && { lon: matchingHistory.lon }),
            ...(matchingHistory?.altitude != null && {
              altitude: matchingHistory.altitude,
            }),
            ...(matchingHistory?.bearing != null && {
              bearing: matchingHistory.bearing,
            }),
            ...(matchingHistory?.cardinal && {
              cardinal: matchingHistory.cardinal,
            }),
          } as MilitaryHistorySighting;
        });

        logger.info('Military history fetched', {
          pushoverUserKey: pushoverUserKey.slice(0, 8),
          count: history.length,
        });

        res.status(200).json({
          success: true,
          history,
          count: history.length,
        });
      } catch (error: any) {
        logger.error('getMilitaryHistory failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );

  return {
    saveMilitarySighting,
    getMilitaryHistory,
  };
}
