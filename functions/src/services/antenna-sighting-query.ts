import { berlinCalendarDay } from './berlin-day';
import type {
  AntennaListQuery,
  AntennaListSort,
  AntennaSighting,
} from './antenna-sighting.types';

export const ANTENNA_LIST_DEFAULT_LIMIT = 500;
export const ANTENNA_LIST_MAX_LIMIT = 2000;

export type AntennaListRow = Omit<AntennaSighting, 'lastMessages'>;

function toRow(row: AntennaSighting): AntennaListRow {
  const { lastMessages: _omit, ...publicRow } = row;
  return publicRow;
}

function matchesQuery(row: AntennaSighting, q: string): boolean {
  if (!q) return true;
  if (row.hex.includes(q)) return true;
  if (row.lastFlight.toLowerCase().includes(q)) return true;
  return row.flights.some((flight) => flight.toLowerCase().includes(q));
}

function compareLastSeen(a: AntennaSighting, b: AntennaSighting): number {
  return b.lastSeen - a.lastSeen;
}

function compareClosest(a: AntennaSighting, b: AntennaSighting): number {
  if (a.closestNm == null && b.closestNm == null) return compareLastSeen(a, b);
  if (a.closestNm == null) return 1;
  if (b.closestNm == null) return -1;
  if (a.closestNm !== b.closestNm) return a.closestNm - b.closestNm;
  return compareLastSeen(a, b);
}

export function parseAntennaListQuery(
  input: Record<string, unknown>,
): AntennaListQuery {
  const q = typeof input.q === 'string' ? input.q.trim().toLowerCase() : '';
  const sortRaw = typeof input.sort === 'string' ? input.sort.trim() : '';
  const sort: AntennaListSort =
    sortRaw === 'closest' ? 'closest' : 'lastSeen';
  const todayRaw = input.today;
  const today =
    todayRaw === true ||
    todayRaw === '1' ||
    todayRaw === 'true' ||
    todayRaw === 'today';
  const limitNum = Number(input.limit);
  const limit = Number.isFinite(limitNum)
    ? Math.min(ANTENNA_LIST_MAX_LIMIT, Math.max(1, Math.floor(limitNum)))
    : ANTENNA_LIST_DEFAULT_LIMIT;
  return { q, sort, today, limit };
}

export function queryAntennaSightings(
  sightings: Record<string, AntennaSighting>,
  query: AntennaListQuery,
): { rows: AntennaListRow[]; matched: number } {
  const now = query.now ?? Date.now();
  const todayKey = query.today ? berlinCalendarDay(now) : null;
  const q = (query.q ?? '').trim().toLowerCase();
  const sort = query.sort === 'closest' ? 'closest' : 'lastSeen';
  const limit = query.limit ?? ANTENNA_LIST_DEFAULT_LIMIT;

  const filtered = Object.values(sightings).filter((row) => {
    if (todayKey && berlinCalendarDay(row.lastSeen) !== todayKey) return false;
    return matchesQuery(row, q);
  });
  filtered.sort(sort === 'closest' ? compareClosest : compareLastSeen);
  return {
    matched: filtered.length,
    rows: filtered.slice(0, limit).map(toRow),
  };
}
