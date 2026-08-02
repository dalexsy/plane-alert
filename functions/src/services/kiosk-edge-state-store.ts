/**
 * Persist kiosk visit-edge records (load / save / migrate legacy ackedIcaos).
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'firebase-functions/v2';

const STATE_FILE = 'kiosk-chime-in-range-state.json';

export type VisitRecord = {
  lastSeenAt: number;
  playedAt: number | null;
};

type EdgeStateFile = {
  visits?: Record<string, Partial<VisitRecord>>;
  ackedIcaos?: unknown;
  updatedAt?: number;
};

let visits: Map<string, VisitRecord> | null = null;

function resolveStatePath(): string {
  const fromEnv = process.env.PLANES_KIOSK_EDGE_STATE?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), 'data', STATE_FILE);
}

export function emptyVisit(now: number): VisitRecord {
  return { lastSeenAt: now, playedAt: null };
}

export function loadVisitMap(): Map<string, VisitRecord> {
  if (visits) return visits;
  visits = new Map();
  const filePath = resolveStatePath();
  const now = Date.now();
  try {
    if (!fs.existsSync(filePath)) return visits;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EdgeStateFile;

    if (raw.visits && typeof raw.visits === 'object') {
      for (const [icao, rec] of Object.entries(raw.visits)) {
        const key = icao.toUpperCase();
        if (!key) continue;
        visits.set(key, {
          lastSeenAt:
            typeof rec?.lastSeenAt === 'number' ? rec.lastSeenAt : now,
          playedAt: typeof rec?.playedAt === 'number' ? rec.playedAt : null,
        });
      }
      return visits;
    }

    // Legacy `{ ackedIcaos: string[] }` → already-played visits.
    if (Array.isArray(raw.ackedIcaos)) {
      for (const item of raw.ackedIcaos) {
        if (typeof item === 'string' && item.length > 0) {
          visits.set(item.toUpperCase(), {
            lastSeenAt: now,
            playedAt: now,
          });
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk edge state load failed', { error: message });
  }
  return visits;
}

export function saveVisitMap(): void {
  const map = loadVisitMap();
  const filePath = resolveStatePath();
  const visitsObj: Record<string, VisitRecord> = {};
  for (const [icao, rec] of [...map.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    visitsObj[icao] = rec;
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({ visits: visitsObj, updatedAt: Date.now() }, null, 2),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Kiosk edge state save failed', { error: message });
  }
}

/** Test/reset helper — clears in-memory map so next load re-reads disk. */
export function resetVisitMapCache(): void {
  visits = null;
}
