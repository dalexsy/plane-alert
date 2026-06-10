import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { applyCors, handleOptionsPreflight } from './http';

export function createRecoverUserKeyFunction(db: admin.firestore.Firestore) {
  return onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyCors(res, 'GET, OPTIONS');
    if (handleOptionsPreflight(req, res)) {
      return;
    }

    try {
      // Query notification-cooldowns to extract user keys
      const cooldownSnapshot = await db
        .collection('notification-cooldowns')
        .limit(100)
        .get();

      if (cooldownSnapshot.empty) {
        res.status(404).json({
          error: 'No cooldown data found - cannot recover user key',
          suggestion: 'The user key may have been completely cleared',
        });
        return;
      }

      const userKeys = new Set<string>();
      const deviceNames = new Set<string>();

      cooldownSnapshot.docs.forEach((doc) => {
        const docId = doc.id;
        // Format: userKey__deviceName__icao or userKey__icao
        const parts = docId.split('__');

        if (parts.length >= 2) {
          const potentialUserKey = parts[0];
          userKeys.add(potentialUserKey);

          if (parts.length === 3) {
            deviceNames.add(parts[1]);
          }
        }
      });

      logger.info('Recovered user data', {
        userKeyCount: userKeys.size,
        deviceNameCount: deviceNames.size,
        cooldownDocs: cooldownSnapshot.size,
      });

      res.status(200).json({
        userKeys: Array.from(userKeys),
        deviceNames: Array.from(deviceNames),
        cooldownDocCount: cooldownSnapshot.size,
      });
    } catch (error: any) {
      logger.error('Failed to recover user key', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
