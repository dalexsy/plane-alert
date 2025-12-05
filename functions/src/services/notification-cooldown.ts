import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { COOLDOWN_COLLECTION } from '../constants';

/**
 * Check if notification should be sent and atomically mark as notified if allowed
 * Uses Firestore transactions to prevent duplicate notifications
 */
export async function checkAndMarkNotified(
  db: admin.firestore.Firestore,
  userKey: string,
  icao: string,
  cooldownMs: number
): Promise<boolean> {
  const cooldownId = `${userKey}__${icao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const now = Date.now();

      if (doc.exists) {
        const data = doc.data();
        const lastSent = data?.lastSent || 0;

        if (now - lastSent < cooldownMs) {
          logger.info('Aircraft in cooldown, skipping', {
            userKey: userKey.slice(0, 8),
            icao,
            timeSinceLastMs: now - lastSent,
            cooldownMs,
          });
          return false;
        }
      }

      logger.info('Claiming notification for aircraft', {
        userKey: userKey.slice(0, 8),
        icao,
        docExists: doc.exists,
      });

      transaction.set(
        cooldownRef,
        {
          userKey,
          icao,
          lastSent: now,
        },
        { merge: true }
      );

      return true;
    });

    logger.info('Transaction result', {
      userKey: userKey.slice(0, 8),
      icao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error: any) {
    logger.error('checkAndMarkNotified transaction failed', {
      userKey: userKey.slice(0, 8),
      icao,
      error,
    });
    return false;
  }
}
