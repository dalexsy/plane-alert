import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export function createClearCooldownsFunction(db: admin.firestore.Firestore) {
  return onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

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
