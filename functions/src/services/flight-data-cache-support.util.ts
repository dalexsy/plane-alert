import { LocalFirestore } from '../local-firestore';
import { logger } from '../pi-logger';
import * as admin from '../admin-compat';

const AEROAPI_STATS_COLLECTION = 'aeroapi-stats';
const DAILY_CALL_LIMIT = 60;

export async function canMakeAeroApiCall(
  db: LocalFirestore,
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const statsRef = db.collection(AEROAPI_STATS_COLLECTION).doc(today);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      const currentCalls = statsDoc.exists ? statsDoc.data()?.calls || 0 : 0;

      if (currentCalls >= DAILY_CALL_LIMIT) {
        logger.warn('Daily AeroAPI call limit reached', {
          date: today,
          calls: currentCalls,
          limit: DAILY_CALL_LIMIT,
        });
        return false;
      }

      transaction.set(
        statsRef,
        { calls: currentCalls + 1, date: today },
        { merge: true },
      );
      return true;
    });

    return result;
  } catch (error) {
    logger.error('Error checking API call limit', { error });
    return true;
  }
}

export async function cleanupExpiredFlightCache(
  db: LocalFirestore,
  collection: string,
  expiredBefore: number,
): Promise<number> {
  try {
    const snapshot = await db
      .collection(collection)
      .where('cachedAt', '<', expiredBefore)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info('Cleaned up expired flight data cache', {
      deleted: snapshot.size,
    });

    return snapshot.size;
  } catch (error) {
    logger.error('Cache cleanup error', { error });
    return 0;
  }
}

export function safeErrorForLogging(error: unknown): {
  message?: string;
  name?: string;
  stack?: string;
  raw?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  try {
    return { raw: JSON.stringify(error) };
  } catch {
    return { raw: String(error) };
  }
}
