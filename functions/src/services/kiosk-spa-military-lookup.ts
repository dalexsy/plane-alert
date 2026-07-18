/**
 * SPA-parity military detection for Pi kiosk chime.
 * Phones use aircraftDb.lookup(icao).mil + military-prefixes.json; ADS-B mil/dbFlags alone miss those.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';
import { isMilitaryCallsign } from '@plane-alert/shared';

let milIcaos: Set<string> | null = null;
let spaPrefixes: string[] | null = null;

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => fs.existsSync(p)) ?? null;
}

function loadMilIcaos(): Set<string> {
  if (milIcaos) return milIcaos;
  const set = new Set<string>();
  const dbPath = firstExisting([
    path.join(process.cwd(), 'data', 'military-aircraft-db.json'),
    path.join(__dirname, '..', 'data', 'military-aircraft-db.json'),
    path.join(__dirname, 'data', 'military-aircraft-db.json'),
  ]);
  if (!dbPath) {
    logger.warn('Kiosk SPA mil DB missing — falling back to ADS-B flags only');
    milIcaos = set;
    return set;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Record<
      string,
      { mil?: boolean }
    >;
    for (const [icao, entry] of Object.entries(raw)) {
      if (entry?.mil === true && icao) {
        set.add(icao.toLowerCase());
      }
    }
    logger.info('Loaded kiosk SPA military ICAO set', {
      path: dbPath,
      count: set.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Failed to load kiosk SPA military DB', { path: dbPath, error: message });
  }
  milIcaos = set;
  return set;
}

function loadSpaPrefixes(): string[] {
  if (spaPrefixes) return spaPrefixes;
  const prefixPath = firstExisting([
    path.join(process.cwd(), 'data', 'military-prefixes.json'),
    path.join(__dirname, '..', 'data', 'military-prefixes.json'),
    path.join(__dirname, 'data', 'military-prefixes.json'),
  ]);
  if (!prefixPath) {
    spaPrefixes = [];
    return spaPrefixes;
  }
  try {
    const list = JSON.parse(fs.readFileSync(prefixPath, 'utf8')) as string[];
    spaPrefixes = (Array.isArray(list) ? list : [])
      .map((p) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
      .filter(Boolean);
    logger.info('Loaded kiosk SPA military prefixes', {
      path: prefixPath,
      count: spaPrefixes.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Failed to load kiosk SPA military prefixes', {
      path: prefixPath,
      error: message,
    });
    spaPrefixes = [];
  }
  return spaPrefixes;
}

/** True when ICAO is marked military in the SPA aircraft DB extract. */
export function isSpaDbMilitaryIcao(icao: string): boolean {
  return loadMilIcaos().has(icao.toLowerCase());
}

/**
 * Callsign military: shared list (RCH, RRR, …) OR SPA military-prefixes.json (JOKER, HAWK, …).
 */
export function isSpaMilitaryCallsign(callsign?: string): boolean {
  if (isMilitaryCallsign(callsign)) return true;
  if (!callsign) return false;
  const normalized = callsign.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!normalized) return false;
  return loadSpaPrefixes().some((prefix) => normalized.startsWith(prefix));
}

/** ADS-B mil / dbFlags with loose typing (some feeds use 1 / "1"). */
export function hasAdsBMilitarySignal(plane: {
  mil?: boolean | number | string;
  dbFlags?: number | string;
}): boolean {
  if (plane.mil === true || plane.mil === 1 || plane.mil === '1') return true;
  const flags = Number(plane.dbFlags);
  return Number.isFinite(flags) && flags === 1;
}
