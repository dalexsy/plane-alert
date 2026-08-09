import { LocalFirestore } from '../local-firestore';
/**
 * Flight Data Cache Manager
 */

import { logger } from '../pi-logger';
import * as admin from '../admin-compat';
import { FlightData, fetchFlightData } from './aeroapi-client';
import {
  canMakeAeroApiCall,
  cleanupExpiredFlightCache,
  safeErrorForLogging,
} from './flight-data-cache-support.util';

const FLIGHT_DATA_COLLECTION = 'flight-data-cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface CachedFlightData extends FlightData {
  cachedAt: number;
  cacheKey: string;
}

function getCacheKey(callsign: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${callsign.trim().toUpperCase()}_${date}`;
}

export async function getFlightData(
  db: LocalFirestore,
  callsign: string,
): Promise<FlightData | null> {
  if (!callsign || !callsign.trim()) {
    return null;
  }

  const cacheKey = getCacheKey(callsign);
  const now = Date.now();

  try {
    const cacheDoc = await db
      .collection(FLIGHT_DATA_COLLECTION)
      .doc(cacheKey)
      .get();

    if (cacheDoc.exists) {
      const cached = cacheDoc.data() as unknown as CachedFlightData;
      const age = now - cached.cachedAt;

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

    const canCall = await canMakeAeroApiCall(db);
    if (!canCall) {
      logger.warn('Skipping AeroAPI call due to daily limit', { callsign });
      return null;
    }

    const flightData = await fetchFlightData(callsign);

    if (!flightData) {
      await db.collection(FLIGHT_DATA_COLLECTION).doc(cacheKey).set(
        {
          cacheKey,
          cachedAt: now,
          ident: callsign,
          noData: true,
        },
        { merge: true },
      );
      return null;
    }

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

export async function batchGetFlightData(
  db: LocalFirestore,
  callsigns: string[],
): Promise<Map<string, FlightData>> {
  const results = new Map<string, FlightData>();
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

    if (i + BATCH_SIZE < callsigns.length) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  return results;
}

export async function cleanupExpiredCache(
  db: LocalFirestore,
): Promise<number> {
  const expiredBefore = Date.now() - CACHE_TTL_MS;
  return cleanupExpiredFlightCache(db, FLIGHT_DATA_COLLECTION, expiredBefore);
}
