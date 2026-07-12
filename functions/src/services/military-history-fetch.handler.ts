import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  COOLDOWN_COLLECTION,
  DEVICE_COLLECTION,
  MILITARY_HISTORY_COLLECTION,
} from '../constants';
import { applyCors, handleOptionsPreflight } from '../http';
import { sanitizeDeviceName, validatePushoverUserKey } from '../utils';
import type { DeviceRegistration } from '../types';
import { parseCooldownDocId } from '../military-history-cooldown.util';
import { buildMilitaryHistoryFromCooldowns } from '../military-history-aggregate.util';
import type {
  MilitaryHistorySighting,
  NotificationCooldownRecord,
} from '../military-history.types';

export function createGetMilitaryHistoryHandler(db: admin.firestore.Firestore) {
  return onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
      region: 'europe-west3',
    },
    async (req, res) => {
      applyCors(res, 'GET, POST, OPTIONS');
      if (handleOptionsPreflight(req, res)) {
        return;
      }

      try {
        const pushoverUserKey =
          req.method === 'GET'
            ? (req.query.pushoverUserKey as string)
            : (req.body as { pushoverUserKey?: string })?.pushoverUserKey;

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
          validation.devices.map((deviceName) =>
            sanitizeDeviceName(deviceName),
          ),
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
          parsed.lastSent =
            typeof data.lastSent === 'number' ? data.lastSent : 0;
          if (!parsed.lastSent) {
            continue;
          }

          const existing = cooldownsByIcao.get(parsed.icao) ?? [];
          existing.push(parsed);
          cooldownsByIcao.set(parsed.icao, existing);
        }

        const history = buildMilitaryHistoryFromCooldowns(
          cooldownsByIcao,
          historyByIcao,
          deviceBySlug,
        );

        logger.info('Military history fetched', {
          pushoverUserKey: pushoverUserKey.slice(0, 8),
          count: history.length,
        });

        res.status(200).json({
          success: true,
          history,
          count: history.length,
        });
      } catch (error: unknown) {
        logger.error('getMilitaryHistory failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );
}
