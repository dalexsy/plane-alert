/**
 * Kiosk PipeWire chime for mil/special in radius — SPA-parity, not Pushover.
 * Live SPA kiosk MP3 is unreliable; phones still TTS on first sighting.
 * Must not depend on device match, boring filter, or cooldown claim.
 *
 * SPA gate (playAlertsForNewPlanes): aircraftDb.mil OR military-prefixes OR special.
 * Do NOT use ADS-B mil/dbFlags alone — that chimed for planes the kiosk list does
 * not mark military (“sound with nothing military on the list”).
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';
import type { AdsBPlane } from '@plane-alert/shared';
import { haversineDistanceKm } from '@plane-alert/shared';
import type { DeviceRegistration } from '../types';
import { clampRadius, isSpecialAircraft } from '../utils';
import { playKioskAlertSound } from './kiosk-alert-sound';
import {
  isSpaDbMilitaryIcao,
  isSpaMilitaryCallsign,
} from './kiosk-spa-military-lookup';
import {
  getDeviceLocation,
  locationCacheKey,
  type CachedAircraftSnapshot,
} from './notification-snapshot-cache';
import { resolveAircraftForNotification } from './resolve-aircraft-for-notification';

const STATE_PATH = path.join(
  process.cwd(),
  'data',
  'kiosk-chime-in-range-state.json',
);

type ChimeState = { inRangeIcaos: string[] };

function loadInRangeState(): Set<string> {
  try {
    if (!fs.existsSync(STATE_PATH)) return new Set();
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as ChimeState;
    const list = Array.isArray(raw?.inRangeIcaos) ? raw.inRangeIcaos : [];
    return new Set(
      list.filter((x): x is string => typeof x === 'string' && x.length > 0),
    );
  } catch {
    return new Set();
  }
}

function saveInRangeState(icaos: Set<string>): void {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const payload: ChimeState = { inRangeIcaos: [...icaos].slice(0, 500) };
    fs.writeFileSync(STATE_PATH, JSON.stringify(payload), 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Failed to persist kiosk chime in-range state', { error: message });
  }
}

/** Same gates as SPA isMilitary / special — never ADS-B mil alone. */
function isSpaAlertAircraft(
  plane: AdsBPlane,
  specialIcaos: string[],
): boolean {
  const icao = plane.hex?.toUpperCase();
  if (!icao) return false;
  if (specialIcaos.includes(icao)) return true;
  if (isSpecialAircraft(plane.hex)) return true;
  if (isSpaDbMilitaryIcao(icao)) return true;
  return isSpaMilitaryCallsign(plane.flight || plane.callsign);
}

export async function chimeKioskForMilitaryInRange(
  docs: Array<{ id: string; data: DeviceRegistration }>,
  aircraftCache: Map<string, CachedAircraftSnapshot>,
): Promise<void> {
  const scannedKeys = new Set<string>();
  const currentAlertIcaos = new Set<string>();
  const previousAlertIcaos = loadInRangeState();

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

    const newlyEntered: string[] = [];
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
      currentAlertIcaos.add(icao);
      if (!previousAlertIcaos.has(icao)) {
        newlyEntered.push(icao);
        playKioskAlertSound(icao, 'military-in-range');
      }
    }

    if (newlyEntered.length) {
      logger.info('Kiosk chime newly in range', {
        locationKey: key,
        count: newlyEntered.length,
        icaos: newlyEntered.slice(0, 8),
      });
    }
  }

  saveInRangeState(currentAlertIcaos);
}
