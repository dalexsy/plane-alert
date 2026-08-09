import { LocalFirestore } from '../local-firestore';
import { logger } from '../pi-logger';
import * as admin from '../admin-compat';
import { COOLDOWN_COLLECTION } from '../constants';

function normalizeCooldownIcao(icao: string): string {
  return icao.trim().toUpperCase();
}

function normalizeCooldownDeviceName(deviceName: string): string {
  return (deviceName ?? '').trim().toLowerCase();
}

function lastSentOf(
  snap: { exists: boolean; data: () => { lastSent?: number } | undefined } | null,
): number {
  if (!snap?.exists) {
    return 0;
  }
  return snap.data()?.lastSent || 0;
}

/**
 * Check if notification should be sent and atomically mark as notified if allowed.
 * Uses the local JSON store's transaction API (Firestore-shaped facade on Pi).
 */
export async function checkAndMarkNotified(
  db: LocalFirestore,
  userKey: string,
  deviceName: string,
  icao: string,
  cooldownMs: number,
): Promise<boolean> {
  const normalizedIcao = normalizeCooldownIcao(icao);
  if (!normalizedIcao) {
    return false;
  }

  // Per-device cooldown so both household phones can notify.
  const normalizedDevice = normalizeCooldownDeviceName(deviceName);
  const cooldownId = normalizedDevice
    ? `${userKey}__${normalizedDevice}__${normalizedIcao}`
    : `${userKey}__${normalizedIcao}`;
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);

  // Only treat as legacy when the path differs — pixel10/galaxys24 are already
  // lowercase, so raw device path === cooldownId and must not be deleted after claim.
  const rawDevicePath = normalizedDevice
    ? `${userKey}__${deviceName}__${normalizedIcao}`
    : null;
  const legacyCooldownRef =
    rawDevicePath && rawDevicePath !== cooldownId
      ? db.collection(COOLDOWN_COLLECTION).doc(rawDevicePath)
      : null;
  const legacyProximityCooldownRef = !normalizedIcao.startsWith('PROXIMITY_')
    ? db
        .collection(COOLDOWN_COLLECTION)
        .doc(`${userKey}__proximity_${normalizedIcao}`)
    : null;
  const legacyUserCooldownRef = db
    .collection(COOLDOWN_COLLECTION)
    .doc(`${userKey}__${normalizedIcao}`);
  const legacyLowercaseCooldownRef = db
    .collection(COOLDOWN_COLLECTION)
    .doc(`${userKey}__${normalizedIcao.toLowerCase()}`);

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const legacyDoc = legacyCooldownRef
        ? await transaction.get(legacyCooldownRef)
        : null;
      const legacyProximityDoc = legacyProximityCooldownRef
        ? await transaction.get(legacyProximityCooldownRef)
        : null;
      const legacyUserDoc = await transaction.get(legacyUserCooldownRef);
      const legacyLowercaseDoc = await transaction.get(legacyLowercaseCooldownRef);
      const now = Date.now();

      const recentLastSent = Math.max(
        lastSentOf(doc),
        lastSentOf(legacyDoc),
        lastSentOf(legacyProximityDoc),
        lastSentOf(legacyUserDoc),
        lastSentOf(legacyLowercaseDoc),
      );

      if (now - recentLastSent < cooldownMs) {
        logger.info('Aircraft in cooldown, skipping', {
          userKey: userKey.slice(0, 8),
          deviceName,
          icao: normalizedIcao,
          timeSinceLastMs: now - recentLastSent,
          cooldownMs,
        });
        return false;
      }

      logger.info('Claiming notification for aircraft', {
        userKey: userKey.slice(0, 8),
        icao: normalizedIcao,
        docExists: doc.exists,
      });

      transaction.set(
        cooldownRef,
        {
          userKey,
          icao: normalizedIcao,
          lastSent: now,
        },
        { merge: true },
      );

      if (legacyCooldownRef && legacyDoc?.exists) {
        transaction.delete(legacyCooldownRef);
      }
      if (legacyProximityCooldownRef && legacyProximityDoc?.exists) {
        transaction.delete(legacyProximityCooldownRef);
      }
      if (
        legacyUserCooldownRef.path !== cooldownRef.path &&
        legacyUserDoc.exists
      ) {
        transaction.delete(legacyUserCooldownRef);
      }
      if (
        legacyLowercaseCooldownRef.path !== cooldownRef.path &&
        legacyLowercaseDoc.exists
      ) {
        transaction.delete(legacyLowercaseCooldownRef);
      }

      return true;
    });

    logger.info('Transaction result', {
      userKey: userKey.slice(0, 8),
      icao: normalizedIcao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('checkAndMarkNotified transaction failed', {
      userKey: userKey.slice(0, 8),
      icao: normalizedIcao,
      error: message,
    });
    return false;
  }
}

export async function releaseNotificationClaim(
  db: LocalFirestore,
  userKey: string,
  deviceName: string,
  icao: string,
): Promise<void> {
  const normalizedIcao = normalizeCooldownIcao(icao);
  if (!normalizedIcao) {
    return;
  }

  const normalizedDevice = normalizeCooldownDeviceName(deviceName);
  const cooldownId = normalizedDevice
    ? `${userKey}__${normalizedDevice}__${normalizedIcao}`
    : `${userKey}__${normalizedIcao}`;

  try {
    await db.collection(COOLDOWN_COLLECTION).doc(cooldownId).delete();
    logger.info('Released notification claim', {
      userKey: userKey.slice(0, 8),
      icao: normalizedIcao,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to release notification claim', {
      userKey: userKey.slice(0, 8),
      icao: normalizedIcao,
      error: message,
    });
  }
}
