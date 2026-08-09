import { LocalFirestore } from './local-firestore';
import { onRequest } from './on-request';
import { logger } from './pi-logger';
import * as admin from './admin-compat';
import { applyCors, handleOptionsPreflight } from './http';

export function createClearCooldownsFunction(db: LocalFirestore) {
  return onRequest({ region: 'europe-west3' }, async (req, res) => {
    applyCors(res, 'GET, OPTIONS');
    if (handleOptionsPreflight(req, res)) {
      return;
    }

    try {
      const snapshot = await db.collection('notification-cooldowns').get();

      if (snapshot.empty) {
        res.status(200).json({ message: 'No cooldowns to clear', cleared: 0 });
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('Cleared notification cooldowns', {
        count: snapshot.size,
      });

      res.status(200).json({
        message: 'Cooldowns cleared successfully',
        cleared: snapshot.size,
      });
    } catch (error: any) {
      logger.error('Failed to clear cooldowns', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
