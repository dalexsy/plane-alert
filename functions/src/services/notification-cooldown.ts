import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { COOLDOWN_COLLECTION } from '../constants';

function normalizeCooldownIcao(icao: string): string {
  return icao.trim().toUpperCase();
}

function normalizeDeviceName(deviceName: string): string {
  return deviceName.trim();
}

function buildCooldownDocId(
  userKey: string,
  deviceName: string,
  normalizedIcao: string,
): string {
  const trimmedDevice = normalizeDeviceName(deviceName);
  if (trimmedDevice) {
    return `${userKey}__${trimmedDevice}__${normalizedIcao}`;
  }
  return `${userKey}__${normalizedIcao}`;
}

/**
 * Check if notification should be sent and atomically mark as notified if allowed.
 * Targeted delivery uses one cooldown per Pushover device + ICAO so each phone
 * on a shared Pushover account (e.g. household) gets its own alert. Broadcast
 * (empty deviceName) uses user+ICAO.
 */
export async function checkAndMarkNotified(
  db: admin.firestore.Firestore,
  userKey: string,
  deviceName: string,
  icao: string,
  cooldownMs: number
): Promise<boolean> {
  const normalizedIcao = normalizeCooldownIcao(icao);
  if (!normalizedIcao) {
    return false;
  }

  const trimmedDevice = normalizeDeviceName(deviceName);
  const cooldownId = buildCooldownDocId(userKey, trimmedDevice, normalizedIcao);
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);
  const legacyProximityCooldownRef =
    trimmedDevice && !normalizedIcao.startsWith('PROXIMITY_')
      ? db
          .collection(COOLDOWN_COLLECTION)
          .doc(`${userKey}__proximity_${normalizedIcao}`)
      : null;
  const legacyLowercaseCooldownRef = db
    .collection(COOLDOWN_COLLECTION)
    .doc(`${userKey}__${normalizedIcao.toLowerCase()}`);

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const legacyAccountWideDoc =
        !trimmedDevice
          ? await transaction.get(
              db.collection(COOLDOWN_COLLECTION).doc(`${userKey}__${normalizedIcao}`),
            )
          : null;
      const legacyProximityDoc = legacyProximityCooldownRef
        ? await transaction.get(legacyProximityCooldownRef)
        : null;
      const legacyLowercaseDoc = !trimmedDevice
        ? await transaction.get(legacyLowercaseCooldownRef)
        : null;
      const now = Date.now();

      const isInCooldown = (lastSent: number) =>
        now - lastSent < cooldownMs;

      const lastSentValues = [
        doc.exists ? doc.data()?.lastSent || 0 : 0,
        legacyAccountWideDoc?.exists
          ? legacyAccountWideDoc.data()?.lastSent || 0
          : 0,
        legacyProximityDoc?.exists
          ? legacyProximityDoc.data()?.lastSent || 0
          : 0,
        legacyLowercaseDoc?.exists ? legacyLowercaseDoc.data()?.lastSent || 0 : 0,
      ];
      const recentLastSent = Math.max(...lastSentValues);

      if (isInCooldown(recentLastSent)) {
        logger.info('Aircraft in cooldown, skipping', {
          userKey: userKey.slice(0, 8),
          deviceName: trimmedDevice || 'ALL',
          icao: normalizedIcao,
          timeSinceLastMs: now - recentLastSent,
          cooldownMs,
        });
        return false;
      }

      logger.info('Claiming notification for aircraft', {
        userKey: userKey.slice(0, 8),
        deviceName: trimmedDevice || 'ALL',
        icao: normalizedIcao,
        docExists: doc.exists,
      });

      transaction.set(
        cooldownRef,
        {
          userKey,
          ...(trimmedDevice ? { deviceName: trimmedDevice } : {}),
          icao: normalizedIcao,
          lastSent: now,
        },
        { merge: true }
      );

      if (legacyProximityDoc?.exists && legacyProximityCooldownRef) {
        transaction.delete(legacyProximityCooldownRef);
      }

      if (legacyLowercaseDoc?.exists) {
        transaction.delete(legacyLowercaseCooldownRef);
      }

      return true;
    });

    logger.info('Transaction result', {
      userKey: userKey.slice(0, 8),
      deviceName: trimmedDevice || 'ALL',
      icao: normalizedIcao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error: any) {
    logger.error('checkAndMarkNotified transaction failed', {
      userKey: userKey.slice(0, 8),
      deviceName: trimmedDevice || 'ALL',
      icao: normalizedIcao,
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
  const normalizedIcao = normalizeCooldownIcao(icao);
  if (!normalizedIcao) {
    return;
  }

  const cooldownId = buildCooldownDocId(userKey, deviceName, normalizedIcao);

  try {
    await db.collection(COOLDOWN_COLLECTION).doc(cooldownId).delete();
    logger.info('Released notification claim', {
      userKey: userKey.slice(0, 8),
      deviceName: deviceName || 'ALL',
      icao: normalizedIcao,
    });
  } catch (error: any) {
    logger.error('Failed to release notification claim', {
      userKey: userKey.slice(0, 8),
      deviceName: deviceName || 'ALL',
      icao: normalizedIcao,
      error,
    });
  }
}
