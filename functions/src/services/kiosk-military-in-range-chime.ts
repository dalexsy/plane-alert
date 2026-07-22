/**
 * Kiosk PipeWire chime for interesting mil/special in radius.
 * Same interestingness gate as Pushover (`isBoringMilitaryAircraft`) — audio is
 * the house speaker for those push alerts. Still independent of device match /
 * cooldown claim so a missed Pushover does not silence magicmirror.
 *
 * Candidate mil: aircraftDb.mil OR military-prefixes OR ADS-B mil/dbFlags OR
 * special. Boring trainers/transports/VIP are skipped unless special.
 *
 * Point `/v2/point` near dense hubs drops in-range mil (returns ~20–30 nearest).
 * Merge `/v2/mil` (all upstreams) and, when that is empty, a ring of offset
 * point queries so magicmirror hears what phones announce from another map center.
 *
 * Chime once per visit (newly in range), not every processPlanes cycle and not
 * on a rolling 30min timer while the same mil loiters. Ack only after pw-play
 * exit 0 (or quiet-hours absorb); prune when the ICAO leaves radius.
 */
import { logger } from 'firebase-functions/v2';
import type { AdsBPlane } from '@plane-alert/shared';
import {
  haversineDistanceKm,
  isBoringMilitaryAircraft,
} from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { clampRadius, isSpecialAircraft } from '../utils';
import {
  fetchAircraftRingAroundHome,
  fetchMilitaryAircraftInRadius,
} from './aircraft-collection-fetch';
import { playKioskAlertSound } from './kiosk-alert-sound';
import {
  ackKioskInRange,
  isKioskInRangeAcked,
  pruneKioskInRangeAcked,
  takeKioskBootAbsorb,
} from './kiosk-in-range-edge-state';
import {
  getSpaAircraftModel,
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
  if (isSpaDbMilitaryIcao(icao)) return true;
  if (hasAdsBMilitarySignal(plane)) return true;
  return isSpaMilitaryCallsign(plane.flight || plane.callsign);
}

/** Same skip as collectMilitaryNotifications — special always alerts. */
function shouldSkipBoringForChime(
  plane: AdsBPlane,
  specialIcaos: string[],
): boolean {
  const icao = plane.hex?.toUpperCase();
  if (icao && specialIcaos.includes(icao)) return false;
  if (isSpecialAircraft(plane.hex)) return false;
  return isBoringMilitaryAircraft(plane);
}

function mergeAircraftByHex(
  primary: AdsBPlane[],
  extra: AdsBPlane[],
): AdsBPlane[] {
  const byHex = new Map<string, AdsBPlane>();
  for (const plane of primary) {
    const hex = plane.hex?.toUpperCase();
    if (hex) byHex.set(hex, plane);
  }
  for (const plane of extra) {
    const hex = plane.hex?.toUpperCase();
    if (hex && !byHex.has(hex)) byHex.set(hex, plane);
  }
  return [...byHex.values()];
}

export async function chimeKioskForMilitaryInRange(
  docs: Array<{ id: string; data: DeviceRegistration }>,
  aircraftCache: Map<string, CachedAircraftSnapshot>,
): Promise<void> {
  const scannedKeys = new Set<string>();
  // Consume once at process start so an empty first home does not leave absorb
  // armed for a later real visit (which must chime).
  const bootAbsorb = takeKioskBootAbsorb();

  for (const entry of docs) {
    const loc = getDeviceLocation(entry.data);
    if (!loc) continue;

    const radiusKm = clampRadius(entry.data.radiusKm);
    const key = locationCacheKey(loc.lat, loc.lon, entry.data.radiusKm);
    if (scannedKeys.has(key)) continue;
    scannedKeys.add(key);

    const pointAircraft = await resolveAircraftForNotification(
      loc,
      radiusKm,
      aircraftCache.get(key),
      `kiosk-chime:${entry.id}`,
    );
    const milInRadius = await fetchMilitaryAircraftInRadius(loc, radiusKm);
    // Mil feed often lists nearby hexes with no lat/lon — ring fills those gaps.
    const ringAircraft =
      milInRadius.length === 0
        ? await fetchAircraftRingAroundHome(loc, radiusKm)
        : [];
    const aircraft = mergeAircraftByHex(
      mergeAircraftByHex(pointAircraft, milInRadius),
      ringAircraft,
    );
    if (!aircraft.length) continue;

    const specialIcaos = (entry.data.specialIcaos ?? []).map((s) =>
      s.toUpperCase(),
    );

    const alertIcaos: string[] = [];
    const newVisitIcaos: string[] = [];
    for (const plane of aircraft) {
      if (!isSpaAlertAircraft(plane, specialIcaos)) continue;
      if (shouldSkipBoringForChime(plane, specialIcaos)) continue;
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
      if (bootAbsorb) {
        ackKioskInRange(icao);
        continue;
      }
      if (isKioskInRangeAcked(icao)) continue;
      newVisitIcaos.push(icao);
      const model =
        plane.desc?.trim() ||
        getSpaAircraftModel(icao) ||
        plane.t?.trim() ||
        '';
      playKioskAlertSound(icao, 'military-in-range', {
        model,
        onPlayed: () => ackKioskInRange(icao),
      });
    }

    pruneKioskInRangeAcked(alertIcaos);

    if (alertIcaos.length) {
      logger.info('Kiosk chime candidates in range', {
        locationKey: key,
        count: alertIcaos.length,
        newVisits: newVisitIcaos.length,
        bootAbsorb,
        icaos: alertIcaos.slice(0, 8),
        newIcaos: newVisitIcaos.slice(0, 8),
        milFeedAdded: milInRadius.length,
        ringAdded: ringAircraft.length,
      });
    }
  }
}
