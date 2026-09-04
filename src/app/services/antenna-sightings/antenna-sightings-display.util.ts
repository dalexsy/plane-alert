import type { AntennaSightingRow } from './antenna-sightings.service';

const BERLIN = 'Europe/Berlin';
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: 'short',
});

export function formatBerlinTime(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  return timeFmt.format(new Date(ms));
}

export function cardinalFromDeg(deg: number | null | undefined): string {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return '';
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[index] ?? '';
}

export function formatClosest(row: AntennaSightingRow): string {
  if (row.closestNm == null) return '—';
  const nm = row.closestNm.toFixed(1);
  const card = cardinalFromDeg(row.closestDir);
  return card ? `${nm} nm ${card}` : `${nm} nm`;
}

export function formatFlight(row: AntennaSightingRow): string {
  return row.lastFlight || row.flights[0] || '—';
}

export type AntennaTableRow = Record<string, unknown> & {
  id: string;
  hex: string;
  flight: string;
  closest: string;
  closestNm: number | null;
  firstSeen: number;
  lastSeen: number;
  firstSeenLabel: string;
  lastSeenLabel: string;
  hits: number;
  messages: number;
};

export function toTableRows(rows: AntennaSightingRow[]): AntennaTableRow[] {
  return rows.map((row) => ({
    id: row.hex,
    hex: row.hex.toUpperCase(),
    flight: formatFlight(row),
    closest: formatClosest(row),
    closestNm: row.closestNm,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    firstSeenLabel: formatBerlinTime(row.firstSeen),
    lastSeenLabel: formatBerlinTime(row.lastSeen),
    hits: row.hits,
    messages: row.messages,
  }));
}
