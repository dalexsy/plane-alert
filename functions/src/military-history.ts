import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { MILITARY_HISTORY_COLLECTION } from './constants';

export interface MilitaryHistorySighting {
  icao: string;
  callsign?: string;
  model?: string;
  operator?: string;
  country?: string;
  registration?: string;
  firstSeen: number;
  lastSeen: number;
  sightingCount: number;
  lat?: number;
  lon?: number;
  altitude?: number;
  bearing?: number;
  cardinal?: string;
}

export function createMilitaryHistoryFunctions(
  db: admin.firestore.Firestore
) {
  /**
   * Save a military plane sighting
   * Creates or updates existing record per pushover key
   */
  const saveMilitarySighting = onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
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
        });
      } else {
        // Create new record
        const newSighting: MilitaryHistorySighting = {
          icao: icao.toLowerCase(),
          firstSeen: now,
          lastSeen: now,
          sightingCount: 1,
          ...(callsign && { callsign }),
          ...(model && { model }),
          ...(operator && { operator }),
          ...(country && { country }),
          ...(registration && { registration }),
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
  });

  /**
   * Get military sighting history for a pushover key
   */
  const getMilitaryHistory = onRequest(
    {
      cors: true,
      timeoutSeconds: 30,
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

      const snapshot = await db
        .collection(MILITARY_HISTORY_COLLECTION)
        .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
        .where(admin.firestore.FieldPath.documentId(), '<', prefixEnd)
        .get();

      const history: MilitaryHistorySighting[] = snapshot.docs.map(
        (doc) => doc.data() as MilitaryHistorySighting
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
    } catch (error: any) {
      logger.error('getMilitaryHistory failed', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return {
    saveMilitarySighting,
    getMilitaryHistory,
  };
}
