/**
 * Kiosk PipeWire chime for mil/special in radius — SPA-parity, not Pushover.
 * Live SPA kiosk MP3 is unreliable; phones still TTS on first sighting.
 * Must not depend on device match, boring filter, or cooldown claim.
 *
 * SPA gate (playAlertsForNewPlanes): aircraftDb.mil OR military-prefixes OR special.
 * ADS-B mil/dbFlags alone misses DB-mil planes that phones already announce.
 */
import { logger } from 'firebase-functions/v2';
import type { AdsBPlane } from '@plane-alert/shared';
import { haversineDistanceKm } from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { clampRadius, isSpecialAircraft } from '../utils';
import { playKioskAlertSound } from './kiosk-alert-sound';
import {
  hasAdsBMilitarySignal,
  isSpaDbMilitaryIcao,
  isSpaMilitaryCallsign,
} from './kiosk-spa-military-lookup';
import {
  getDeviceLocation,
  locationCacheKey,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';

function isSpaAlertAircraft(
  plane: AdsBPlane,
  specialIcaos: string[],
): boolean {
  const icao = plane.hex?.toUpperCase();
  if (!icao) return false;
  if (specialIcaos.includes(icao)) return true;
  if (isSpecialAircraft(plane.hex)) return true;
  // Same as SPA aircraftDb.lookup(icao)?.mil
  if (isSpaDbMilitaryIcao(icao)) return true;
  const callsign = plane.flight || plane.callsign;
  // ADS-B flags + shared/SPA callsign prefixes
  return hasAdsBMilitarySignal(plane) || isSpaMilitaryCallsign(callsign);
}

export async function chimeKioskForMilitaryInRange(
  docs: Array<{ id: string; data: DeviceRegistration }>,
  aircraftCache: Map<string, CachedAircraftSnapshot>,
): Promise<void> {
  const scannedKeys = new Set<string>();

  for (const entry of docs) {
    const loc = getDeviceLocation(entry.data);
    if (!loc) continue;

    const radiusKm = clampRadius(entry.data.radiusKm);
    const key = locationCacheKey(loc.lat, loc.lon, entry.data.radiusKm);
    if (scannedKeys.has(key)) continue;
    scannedKeys.add(key);

    const aircraft = await resolveAircraftForNotification(
      loc,
      radiusKm,
      aircraftCache.get(key),
      `kiosk-chime:${entry.id}`,
    );
    if (!aircraft.length) continue;

    const specialIcaos = (entry.data.specialIcaos ?? []).map((s) =>
      s.toUpperCase(),
    );

    const alertIcaos: string[] = [];
    for (const plane of aircraft) {
      if (!isSpaAlertAircraft(plane, specialIcaos)) continue;
      const icao = plane.hex!.toUpperCase();
      if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') {
        continue;
      }
      const distanceKm = haversineDistanceKm(
        loc.lat,
        loc.lon,
        plane.lat,
        plane.lon,
      );
      if (distanceKm > radiusKm) continue;
      alertIcaos.push(icao);
      playKioskAlertSound(icao, 'military-in-range');
    }

    if (alertIcaos.length) {
      logger.info('Kiosk chime candidates in range', {
        locationKey: key,
        count: alertIcaos.length,
        icaos: alertIcaos.slice(0, 8),
      });
    }
  }
}
