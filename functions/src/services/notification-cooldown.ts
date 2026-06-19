import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { COOLDOWN_COLLECTION } from '../constants';

/**
 * Check if notification should be sent and atomically mark as notified if allowed
 * Uses Firestore transactions to prevent duplicate notifications
 *
 * @param db - Firestore database instance
 * @param userKey - Pushover user key
 * @param deviceName - Pushover device name (legacy per-device cooldown lookup only)
 * @param icao - Aircraft ICAO hex code
 * @param cooldownMs - Cooldown period in milliseconds
 */
export async function checkAndMarkNotified(
  db: admin.firestore.Firestore,
  userKey: string,
  deviceName: string,
  icao: string,
  cooldownMs: number
): Promise<boolean> {
  // One cooldown per user+ICAO so duplicate registrations cannot double-notify.
  const cooldownId = `${userKey}__${icao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);
  const legacyCooldownRef = deviceName
    ? db
        .collection(COOLDOWN_COLLECTION)
        .doc(`${userKey}__${deviceName}__${icao}`)
    : null;

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const legacyDoc = legacyCooldownRef
        ? await transaction.get(legacyCooldownRef)
        : null;
      const now = Date.now();

      const isInCooldown = (lastSent: number) =>
        now - lastSent < cooldownMs;

      const lastSentValues = [
        doc.exists ? doc.data()?.lastSent || 0 : 0,
        legacyDoc?.exists ? legacyDoc.data()?.lastSent || 0 : 0,
      ];
      const recentLastSent = Math.max(...lastSentValues);

      if (isInCooldown(recentLastSent)) {
        logger.info('Aircraft in cooldown, skipping', {
          userKey: userKey.slice(0, 8),
          deviceName,
          icao,
          timeSinceLastMs: now - recentLastSent,
          cooldownMs,
        });
        return false;
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

      if (legacyCooldownRef && legacyDoc?.exists) {
        transaction.delete(legacyCooldownRef);
      }

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

export async function releaseNotificationClaim(
  db: admin.firestore.Firestore,
  userKey: string,
  _deviceName: string,
  icao: string
): Promise<void> {
  const cooldownId = `${userKey}__${icao}`;

  try {
    await db.collection(COOLDOWN_COLLECTION).doc(cooldownId).delete();
    logger.info('Released notification claim', {
      userKey: userKey.slice(0, 8),
      icao,
    });
  } catch (error: any) {
    logger.error('Failed to release notification claim', {
      userKey: userKey.slice(0, 8),
      icao,
      error,
    });
  }
}
