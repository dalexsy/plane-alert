import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { MILITARY_HISTORY_COLLECTION } from '../constants';
import { applyCors, handleOptionsPreflight } from '../http';
import type { MilitaryHistorySighting } from '../military-history.types';

export function createSaveMilitarySightingHandler(db: admin.firestore.Firestore) {
  return onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
      region: 'europe-west3',
    },
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

        const docId = `${pushoverUserKey}__${icao.toLowerCase()}`;
        const docRef = db.collection(MILITARY_HISTORY_COLLECTION).doc(docId);
        const existing = await docRef.get();
        const now = Date.now();

        if (existing.exists) {
          const data = existing.data() as MilitaryHistorySighting;
          await docRef.update({
            lastSeen: now,
            sightingCount: (data.sightingCount || 1) + 1,
            ...(lat != null && { lat }),
            ...(lon != null && { lon }),
            ...(altitude != null && { altitude }),
            ...(bearing != null && { bearing }),
            ...(cardinal && { cardinal }),
            ...(callsign && { callsign }),
            ...(model && { model }),
            ...(operator && { operator }),
            ...(country && { country }),
            ...(registration && { registration }),
            ...(notifiedDeviceName && { notifiedDeviceName }),
            ...(notificationLocation && { notificationLocation }),
          });
        } else {
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
      } catch (error: unknown) {
        logger.error('saveMilitarySighting failed', error);
        res.status(500).json({ error: 'Internal error' });
      }
    },
  );
}
