/**
 * Flight Data Cache Manager
 * Handles caching of AeroAPI flight data in Firestore
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FlightData, fetchFlightData } from './aeroapi-client';

const FLIGHT_DATA_COLLECTION = 'flight-data-cache';
// Keep cache long enough to avoid repeated calls for the same flight during the day,
// but not so long that we show stale routes for reused callsigns.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const AEROAPI_STATS_COLLECTION = 'aeroapi-stats';
// $10/mo budget @ $0.005/call => 2000 calls/month ≈ 66/day. Keep some headroom.
const DAILY_CALL_LIMIT = 60;

function safeErrorForLogging(error: unknown): {
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

interface CachedFlightData extends FlightData {
  cachedAt: number;
  cacheKey: string;
}

/**
 * Generate cache key from callsign + day.
 * Military/GA callsigns can be reused across different days; caching forever can show wrong routes.
 * Per-day caching still prevents repeated lookups while a flight is active/nearby.
 */
function getCacheKey(callsign: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
  return `${callsign.trim().toUpperCase()}_${date}`;
}

/**
 * Check if daily API call limit has been reached
 * Returns true if we can make more calls, false if limit reached
 */
async function canMakeApiCall(db: admin.firestore.Firestore): Promise<boolean> {
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

      // Increment counter
      transaction.set(
        statsRef,
        { calls: currentCalls + 1, date: today },
        { merge: true }
      );
      return true;
    });

    return result;
  } catch (error) {
    logger.error('Error checking API call limit', { error });
    // Allow call on error to avoid blocking legitimate requests
    return true;
  }
}

/**
 * Get flight data from cache or fetch from AeroAPI
 */
export async function getFlightData(
  db: admin.firestore.Firestore,
  callsign: string
): Promise<FlightData | null> {
  if (!callsign || !callsign.trim()) {
    return null;
  }

  const cacheKey = getCacheKey(callsign);
  const now = Date.now();

  try {
    // Check cache first
    const cacheDoc = await db
      .collection(FLIGHT_DATA_COLLECTION)
      .doc(cacheKey)
      .get();

    if (cacheDoc.exists) {
      const cached = cacheDoc.data() as CachedFlightData;
      const age = now - cached.cachedAt;

      // Return cached data if still fresh
      if (age < CACHE_TTL_MS) {
        logger.debug('Flight data cache hit', {
          callsign,
          cacheKey,
          ageMinutes: Math.round(age / 60000),
        });
        return cached;
      }

      logger.debug('Flight data cache expired', {
        callsign,
        cacheKey,
        ageHours: Math.round(age / 3600000),
      });
    }

    // Cache miss or expired - fetch from AeroAPI
    // Check if we've hit daily limit
    const canCall = await canMakeApiCall(db);
    if (!canCall) {
      logger.warn('Skipping AeroAPI call due to daily limit', { callsign });
      return null;
    }

    const flightData = await fetchFlightData(callsign);

    if (!flightData) {
      // Store null result to avoid repeated API calls for aircraft without flight data
      await db.collection(FLIGHT_DATA_COLLECTION).doc(cacheKey).set(
        {
          cacheKey,
          cachedAt: now,
          ident: callsign,
          noData: true,
        },
        { merge: true }
      );
      return null;
    }

    // Store successful result
    const cached: CachedFlightData = {
      ...flightData,
      cacheKey,
      cachedAt: now,
    };

    await db
      .collection(FLIGHT_DATA_COLLECTION)
      .doc(cacheKey)
      .set(cached, { merge: true });

    logger.info('Flight data cached', {
      callsign,
      cacheKey,
      origin: flightData.origin?.code,
      destination: flightData.destination?.code,
    });

    return flightData;
  } catch (error) {
    logger.error('Flight data cache error', {
      callsign,
      cacheKey,
      error: safeErrorForLogging(error),
    });
    return null;
  }
}

/**
 * Batch fetch flight data for multiple aircraft
 * Useful for enriching aircraft snapshots
 */
export async function batchGetFlightData(
  db: admin.firestore.Firestore,
  callsigns: string[]
): Promise<Map<string, FlightData>> {
  const results = new Map<string, FlightData>();

  // Process in parallel with rate limiting
  const BATCH_SIZE = 3;
  for (let i = 0; i < callsigns.length; i += BATCH_SIZE) {
    const batch = callsigns.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (callsign) => {
      const data = await getFlightData(db, callsign);
      if (data) {
        results.set(callsign.toUpperCase(), data);
      }
    });

    await Promise.all(promises);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < callsigns.length) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  return results;
}

/**
 * Clean up expired cache entries
 * Should be run periodically (e.g., daily)
 */
export async function cleanupExpiredCache(
  db: admin.firestore.Firestore
): Promise<number> {
  const now = Date.now();
  const expiredBefore = now - CACHE_TTL_MS;

  try {
    const snapshot = await db
      .collection(FLIGHT_DATA_COLLECTION)
      .where('cachedAt', '<', expiredBefore)
      .limit(500) // Process in batches
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
