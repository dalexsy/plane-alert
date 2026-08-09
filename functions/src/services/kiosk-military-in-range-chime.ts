/**
 * Kiosk PipeWire chime — same `shouldAlertForAircraft` gate as Pushover.
 * Independent of device match / cooldown so a missed push does not silence
 * the house speaker for an aircraft that would have been notified.
 *
 * Point `/v2/point` near dense hubs drops in-range mil; merge `/v2/mil` and
 * ring fills so magicmirror hears visits phones would push from another center.
 *
 * Chime once per visit; ack only after pw-play exit 0 (or quiet-hours absorb).
 * Prune uses the union of all homes + grace — never per-home hard drop.
 */
import { logger } from '../pi-logger';
import type { AdsBPlane } from '@plane-alert/shared';
import {
  haversineDistanceKm,
  shouldAlertForAircraft,
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
  touchKioskInRange,
} from './kiosk-in-range-edge-state';
import { getSpaAircraftModel } from './kiosk-spa-military-lookup';
import {
  getDeviceLocation,
  locationCacheKey,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';

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

type PendingChime = {
  icao: string;
  model: string;
};

export async function chimeKioskForMilitaryInRange(
  docs: Array<{ id: string; data: DeviceRegistration }>,
  aircraftCache: Map<string, CachedAircraftSnapshot>,
): Promise<void> {
  const scannedKeys = new Set<string>();
  const bootAbsorb = takeKioskBootAbsorb();
  /** Union of alertable ICAOs across every home — single prune at end. */
  const allAlertIcaos = new Set<string>();
  const pendingByIcao = new Map<string, PendingChime>();
  const locationSummaries: Array<{
    locationKey: string;
    count: number;
    icaos: string[];
    milFeedAdded: number;
    ringAdded: number;
  }> = [];

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
    for (const plane of aircraft) {
      const icao = plane.hex?.toUpperCase();
      if (!icao) continue;
      const isSpecial =
        specialIcaos.includes(icao) || isSpecialAircraft(plane.hex);
      if (!shouldAlertForAircraft(plane, { isSpecial })) continue;
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
      allAlertIcaos.add(icao);
      touchKioskInRange(icao);

      if (bootAbsorb) {
        ackKioskInRange(icao);
        continue;
      }
      if (isKioskInRangeAcked(icao)) continue;
      if (pendingByIcao.has(icao)) continue;

      const model =
        plane.desc?.trim() ||
        getSpaAircraftModel(icao) ||
        plane.t?.trim() ||
        '';
      pendingByIcao.set(icao, { icao, model });
    }

    if (alertIcaos.length) {
      locationSummaries.push({
        locationKey: key,
        count: alertIcaos.length,
        icaos: alertIcaos.slice(0, 8),
        milFeedAdded: milInRadius.length,
        ringAdded: ringAircraft.length,
      });
    }
  }

  // One prune for the union of all homes. Empty union still only expires after
  // grace — a total feed miss for one cycle must not re-arm every visit.
  pruneKioskInRangeAcked(allAlertIcaos);

  const newVisitIcaos: string[] = [];
  for (const pending of pendingByIcao.values()) {
    // Re-check after prune/touch — should still be unacked for new visits.
    if (isKioskInRangeAcked(pending.icao)) continue;
    newVisitIcaos.push(pending.icao);
    playKioskAlertSound(pending.icao, 'military-in-range', {
      model: pending.model,
      onPlayed: () => ackKioskInRange(pending.icao),
    });
  }

  if (allAlertIcaos.size || newVisitIcaos.length) {
    logger.info('Kiosk chime candidates in range', {
      homes: locationSummaries.length,
      count: allAlertIcaos.size,
      newVisits: newVisitIcaos.length,
      bootAbsorb,
      icaos: [...allAlertIcaos].slice(0, 8),
      newIcaos: newVisitIcaos.slice(0, 8),
      locations: locationSummaries.slice(0, 4),
    });
  }
}
