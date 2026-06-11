import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { COOLDOWN_COLLECTION } from '../constants';

/**
 * Check if notification should be sent and atomically mark as notified if allowed
 * Uses Firestore transactions to prevent duplicate notifications
 *
 * @param db - Firestore database instance
 * @param userKey - Pushover user key
 * @param deviceName - Device name (for per-device cooldown) - if empty, uses per-user cooldown
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
  // Cooldown is per-device - each device gets its own notification for matching aircraft
  // This allows the same aircraft to notify multiple devices, but prevents duplicates on same device
  const cooldownId = deviceName
    ? `${userKey}__${deviceName}__${icao}`
    : `${userKey}__${icao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const now = Date.now();

      const isInCooldown = (lastSent: number) =>
        now - lastSent < cooldownMs;

      if (doc.exists) {
        const data = doc.data();
        const lastSent = data?.lastSent || 0;

        if (isInCooldown(lastSent)) {
          logger.info('Aircraft in cooldown, skipping', {
            userKey: userKey.slice(0, 8),
            icao,
            timeSinceLastMs: now - lastSent,
            cooldownMs,
          });
          return false;
        }
      }

      if (deviceName) {
        const userWideRef = db
          .collection(COOLDOWN_COLLECTION)
          .doc(`${userKey}__${icao}`);
        const userWideDoc = await transaction.get(userWideRef);
        if (userWideDoc.exists) {
          const lastSent = userWideDoc.data()?.lastSent || 0;
          if (isInCooldown(lastSent)) {
            logger.info('Aircraft in user-wide cooldown, skipping', {
              userKey: userKey.slice(0, 8),
              deviceName,
              icao,
              timeSinceLastMs: now - lastSent,
              cooldownMs,
            });
            return false;
          }
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

export async function releaseNotificationClaim(
  db: admin.firestore.Firestore,
  userKey: string,
  deviceName: string,
  icao: string
): Promise<void> {
  const cooldownId = deviceName
    ? `${userKey}__${deviceName}__${icao}`
    : `${userKey}__${icao}`;

  try {
    await db.collection(COOLDOWN_COLLECTION).doc(cooldownId).delete();
    logger.info('Released notification claim', {
      userKey: userKey.slice(0, 8),
      deviceName,
      icao,
    });
  } catch (error: any) {
    logger.error('Failed to release notification claim', {
      userKey: userKey.slice(0, 8),
      deviceName,
      icao,
      error,
    });
  }
}
