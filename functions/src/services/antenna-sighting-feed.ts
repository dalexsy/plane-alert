import { fetchWithTimeout } from './aircraft-adsb-point';
import { ORIGIN_HEADER } from '../constants';
import type { AntennaSnapshotAc } from './antenna-sighting.types';

export const DEFAULT_ANTENNA_FEED_URL =
  'http://192.168.178.27/tar1090/data/aircraft.json';

export function antennaFeedUrl(): string {
  return process.env.PLANES_ANTENNA_FEED_URL?.trim() || DEFAULT_ANTENNA_FEED_URL;
}

export function antennaPollMs(): number {
  const raw = Number(process.env.PLANES_ANTENNA_POLL_MS);
  if (!Number.isFinite(raw)) return 12_000;
  return Math.min(60_000, Math.max(5_000, Math.floor(raw)));
}

export function antennaPollerEnabled(): boolean {
  const raw = process.env.PLANES_ANTENNA_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

function aircraftFromPayload(payload: unknown): AntennaSnapshotAc[] {
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as { ac?: unknown; aircraft?: unknown };
  const ac = Array.isArray(row.ac) ? row.ac : [];
  const aircraft = Array.isArray(row.aircraft) ? row.aircraft : [];
  const list = aircraft.length >= ac.length ? aircraft : ac;
  return list.filter((item) => item && typeof item === 'object') as AntennaSnapshotAc[];
}

function snapshotTime(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== 'object') return fallback;
  const now = (payload as { now?: unknown }).now;
  if (typeof now === 'number' && Number.isFinite(now) && now > 1e9) {
    return Math.round(now * 1000);
  }
  return fallback;
}

export async function fetchAntennaSnapshot(feedUrl: string): Promise<{
  aircraft: AntennaSnapshotAc[];
  at: number;
}> {
  const response = await fetchWithTimeout(
    feedUrl,
    {
      headers: {
        'User-Agent': ORIGIN_HEADER,
        Accept: 'application/json',
      },
    },
    8_000,
  );
  if (!response.ok) {
    throw new Error(`antenna feed HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  const wall = Date.now();
  return {
    aircraft: aircraftFromPayload(payload),
    at: snapshotTime(payload, wall),
  };
}
