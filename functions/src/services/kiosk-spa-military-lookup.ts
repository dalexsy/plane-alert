/**
 * SPA-parity military detection for Pi kiosk chime.
 * Phones use aircraftDb.lookup(icao).mil + military-prefixes.json; ADS-B mil/dbFlags alone miss those.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';
import { isMilitaryCallsign } from '@plane-alert/shared';

let milIcaos: Set<string> | null = null;
/** ICAO → model string from military-aircraft-db (for A400/Hercules chime pick). */
let milModels: Map<string, string> | null = null;
let spaPrefixes: string[] | null = null;

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => fs.existsSync(p)) ?? null;
}

function loadMilDb(): void {
  if (milIcaos && milModels) return;
  const set = new Set<string>();
  const models = new Map<string, string>();
  const dbPath = firstExisting([
    path.join(process.cwd(), 'data', 'military-aircraft-db.json'),
    path.join(__dirname, '..', 'data', 'military-aircraft-db.json'),
    path.join(__dirname, 'data', 'military-aircraft-db.json'),
  ]);
  if (!dbPath) {
    logger.warn('Kiosk SPA mil DB missing — falling back to ADS-B flags only');
    milIcaos = set;
    milModels = models;
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Record<
      string,
      { mil?: boolean; model?: string }
    >;
    for (const [icao, entry] of Object.entries(raw)) {
      if (!icao) continue;
      const key = icao.toLowerCase();
      if (entry?.mil === true) set.add(key);
      const model = entry?.model?.trim();
      if (model) models.set(key, model);
    }
    logger.info('Loaded kiosk SPA military ICAO set', {
      path: dbPath,
      count: set.size,
      models: models.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Failed to load kiosk SPA military DB', { path: dbPath, error: message });
  }
  milIcaos = set;
  milModels = models;
}

function loadMilIcaos(): Set<string> {
  loadMilDb();
  return milIcaos!;
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

/** Aircraft model from military DB (empty when unknown). */
export function getSpaAircraftModel(icao: string): string {
  loadMilDb();
  return milModels?.get(icao.toLowerCase()) ?? '';
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
