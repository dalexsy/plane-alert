/**
 * Visit-edge state for kiosk mil chimes.
 * Ack only after successful play (or quiet/boot absorb).
 * Clear only after GRACE_MS without a sighting — not on one feed miss.
 */
import { logger } from '../pi-logger';
import {
  emptyVisit,
  loadVisitMap,
  saveVisitMap,
} from './kiosk-edge-state-store';

/**
 * Keep visit ack through feed gaps / multi-home scans that miss one ICAO.
 * Longer than a few processPlanes cycles (~2min); true leave+return can chime.
 */
export const KIOSK_IN_RANGE_GRACE_MS = 15 * 60 * 1000;

/** First scan after process start absorbs current visits (no deploy blast). */
let bootAbsorbPending = true;

export function takeKioskBootAbsorb(): boolean {
  if (!bootAbsorbPending) return false;
  bootAbsorbPending = false;
  return true;
}

/** True when this visit already chimed (or was boot/quiet absorbed). */
export function isKioskInRangeAcked(icao: string): boolean {
  const rec = loadVisitMap().get(icao.toUpperCase());
  return rec != null && rec.playedAt != null;
}

/** Mark visit chimed — only after pw-play exit 0 or quiet-hours absorb. */
export function ackKioskInRange(icao: string, now: number = Date.now()): void {
  const key = icao.toUpperCase();
  const map = loadVisitMap();
  const existing = map.get(key);
  if (existing?.playedAt != null) {
    if (existing.lastSeenAt < now) {
      existing.lastSeenAt = now;
      saveVisitMap();
    }
    return;
  }
  map.set(key, {
    lastSeenAt: Math.max(existing?.lastSeenAt ?? now, now),
    playedAt: now,
  });
  saveVisitMap();
}

/**
 * Note ICAO still alertable in range (any home). Memory-only — prune at end of
 * the cycle persists the union touch so we do not rewrite disk per aircraft.
 */
export function touchKioskInRange(icao: string, now: number = Date.now()): void {
  const key = icao.toUpperCase();
  if (!key) return;
  const map = loadVisitMap();
  const existing = map.get(key);
  if (existing) {
    existing.lastSeenAt = now;
    return;
  }
  map.set(key, emptyVisit(now));
}

/**
 * Touch every ICAO still in range (union of all homes), then drop visits whose
 * last sighting is older than grace. Call once per processPlanes cycle.
 */
export function pruneKioskInRangeAcked(
  stillInRange: Iterable<string>,
  now: number = Date.now(),
  graceMs: number = KIOSK_IN_RANGE_GRACE_MS,
): void {
  const map = loadVisitMap();
  const keep = new Set(
    [...stillInRange].map((icao) => icao.toUpperCase()).filter(Boolean),
  );

  let changed = false;
  for (const icao of keep) {
    const existing = map.get(icao);
    if (existing) {
      if (existing.lastSeenAt !== now) {
        existing.lastSeenAt = now;
        changed = true;
      }
    } else {
      map.set(icao, emptyVisit(now));
      changed = true;
    }
  }

  const dropped: string[] = [];
  for (const [icao, rec] of [...map.entries()]) {
    if (keep.has(icao)) continue;
    if (now - rec.lastSeenAt < graceMs) continue;
    map.delete(icao);
    dropped.push(icao);
    changed = true;
  }

  // Always persist when we saw anyone: touch() is memory-only until here.
  if (changed || keep.size > 0) {
    saveVisitMap();
  }
  if (dropped.length) {
    logger.info('Kiosk edge state pruned after grace', {
      dropped: dropped.slice(0, 12),
      count: dropped.length,
      graceMs,
    });
  }
}
