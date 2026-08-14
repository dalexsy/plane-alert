import { JsonDocumentStore } from '../json-document-store';
import { logger } from '../pi-logger';
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

function householdCooldownId(userKey: string, icao: string): string {
  return `${userKey.trim()}__${icao}`;
}

function legacyCooldownIds(
  userKey: string,
  deviceName: string,
  icao: string,
): string[] {
  const normalizedDevice = normalizeCooldownDeviceName(deviceName);
  const ids = new Set<string>();
  if (normalizedDevice && !normalizedDevice.includes(',')) {
    ids.add(`${userKey}__${normalizedDevice}__${icao}`);
    const raw = `${userKey}__${deviceName}__${icao}`;
    if (raw !== `${userKey}__${normalizedDevice}__${icao}`) {
      ids.add(raw);
    }
  }
  if (!icao.startsWith('PROXIMITY_')) {
    ids.add(`${userKey}__proximity_${icao}`);
  }
  ids.add(`${userKey}__${icao.toLowerCase()}`);
  ids.delete(householdCooldownId(userKey, icao));
  return [...ids];
}

/**
 * Claim one send per Pushover account + ICAO.
 * One account means one API call (`device=galaxys24,pixel10`), not one claim
 * per phone. Putting the device name back in this id (`5cc5b90`) is the
 * regression that doubled the inbox. Daryl did not report a missed phone.
 */
export async function checkAndMarkNotified(
  db: JsonDocumentStore,
  userKey: string,
  deviceName: string,
  icao: string,
  cooldownMs: number,
): Promise<boolean> {
  const normalizedIcao = normalizeCooldownIcao(icao);
  const normalizedUserKey = userKey.trim();
  if (!normalizedIcao || !normalizedUserKey) {
    return false;
  }

  const cooldownId = householdCooldownId(normalizedUserKey, normalizedIcao);
  const cooldownRef = db.collection(COOLDOWN_COLLECTION).doc(cooldownId);
  const legacyRefs = legacyCooldownIds(
    normalizedUserKey,
    deviceName,
    normalizedIcao,
  ).map(
    (id) => db.collection(COOLDOWN_COLLECTION).doc(id),
  );

  try {
    const shouldNotify = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cooldownRef);
      const legacyDocs = await Promise.all(
        legacyRefs.map((ref) => transaction.get(ref)),
      );
      const now = Date.now();
      const recentLastSent = Math.max(
        lastSentOf(doc),
        ...legacyDocs.map((snap) => lastSentOf(snap)),
      );

      if (now - recentLastSent < cooldownMs) {
        logger.info('Aircraft in cooldown, skipping', {
          userKey: normalizedUserKey.slice(0, 8),
          deviceName,
          icao: normalizedIcao,
          timeSinceLastMs: now - recentLastSent,
          cooldownMs,
        });
        return false;
      }

      logger.info('Claiming notification for aircraft', {
        userKey: normalizedUserKey.slice(0, 8),
        icao: normalizedIcao,
        docExists: doc.exists,
      });

      transaction.set(
        cooldownRef,
        {
          userKey: normalizedUserKey,
          icao: normalizedIcao,
          lastSent: now,
        },
        { merge: true },
      );

      for (const [index, legacyRef] of legacyRefs.entries()) {
        if (legacyDocs[index]?.exists) {
          transaction.delete(legacyRef);
        }
      }

      return true;
    });

    logger.info('Transaction result', {
      userKey: normalizedUserKey.slice(0, 8),
      icao: normalizedIcao,
      shouldNotify,
    });

    return shouldNotify;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('checkAndMarkNotified transaction failed', {
      userKey: normalizedUserKey.slice(0, 8),
      icao: normalizedIcao,
      error: message,
    });
    return false;
  }
}

export async function releaseNotificationClaim(
  db: JsonDocumentStore,
  userKey: string,
  deviceName: string,
  icao: string,
): Promise<void> {
  const normalizedIcao = normalizeCooldownIcao(icao);
  const normalizedUserKey = userKey.trim();
  if (!normalizedIcao || !normalizedUserKey) {
    return;
  }

  const cooldownId = householdCooldownId(normalizedUserKey, normalizedIcao);

  try {
    await db.collection(COOLDOWN_COLLECTION).doc(cooldownId).delete();
    logger.info('Released notification claim', {
      userKey: normalizedUserKey.slice(0, 8),
      icao: normalizedIcao,
      deviceName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to release notification claim', {
      userKey: normalizedUserKey.slice(0, 8),
      icao: normalizedIcao,
      error: message,
    });
  }
}
