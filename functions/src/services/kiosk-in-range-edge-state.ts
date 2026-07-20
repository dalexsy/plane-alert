/**
 * Visit-edge state for kiosk mil chimes.
 * Ack an ICAO only after a successful play (or quiet-hours absorb).
 * Clear when it leaves radius so a later re-entry can chime again.
 * Never ack before play succeeds — that blocked retries after silent spawns.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';

const STATE_FILE = 'kiosk-chime-in-range-state.json';

let ackedIcaos: Set<string> | null = null;

function resolveStatePath(): string {
  const fromEnv = process.env.PLANES_KIOSK_EDGE_STATE?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), 'data', STATE_FILE);
}

function load(): Set<string> {
  if (ackedIcaos) return ackedIcaos;
  ackedIcaos = new Set();
  const filePath = resolveStatePath();
  try {
    if (!fs.existsSync(filePath)) return ackedIcaos;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      ackedIcaos?: unknown;
    };
    if (!Array.isArray(raw.ackedIcaos)) return ackedIcaos;
    for (const item of raw.ackedIcaos) {
      if (typeof item === 'string' && item.length > 0) {
        ackedIcaos.add(item.toUpperCase());
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk edge state load failed', { error: message });
  }
  return ackedIcaos;
}

function save(): void {
  const set = load();
  const filePath = resolveStatePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        { ackedIcaos: [...set].sort(), updatedAt: Date.now() },
        null,
        2,
      ),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk edge state save failed', { error: message });
  }
}

export function isKioskInRangeAcked(icao: string): boolean {
  return load().has(icao.toUpperCase());
}

/** Mark visit chimed — call only after pw-play exit 0 or quiet-hours absorb. */
export function ackKioskInRange(icao: string): void {
  const key = icao.toUpperCase();
  const set = load();
  if (set.has(key)) return;
  set.add(key);
  save();
}

/** Drop ICAOs that left the radius so a later return can alert again. */
export function pruneKioskInRangeAcked(stillInRange: Iterable<string>): void {
  const set = load();
  const keep = new Set(
    [...stillInRange].map((icao) => icao.toUpperCase()).filter(Boolean),
  );
  let changed = false;
  for (const icao of [...set]) {
    if (!keep.has(icao)) {
      set.delete(icao);
      changed = true;
    }
  }
  if (changed) save();
}
