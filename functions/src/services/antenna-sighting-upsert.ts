import type { AntennaSighting, AntennaSnapshotAc } from './antenna-sighting.types';

const MAX_FLIGHTS = 8;

export function normalizeHex(hex: unknown): string | null {
  if (typeof hex !== 'string') return null;
  const trimmed = hex.trim().toLowerCase();
  return trimmed || null;
}

export function normalizeFlight(flight: unknown): string {
  if (typeof flight !== 'string') return '';
  return flight.trim().replace(/\s+/g, ' ');
}

export function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && value !== 'ground') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mergeFlights(existing: string[], next: string): string[] {
  if (!next) return existing;
  return [next, ...existing.filter((flight) => flight !== next)].slice(
    0,
    MAX_FLIGHTS,
  );
}

function accumulateMessages(
  prevLast: number | null,
  incoming: number | null,
  prevAccum: number,
): { messages: number; lastMessages: number | null } {
  if (incoming == null) {
    return { messages: prevAccum, lastMessages: prevLast };
  }
  if (prevLast == null) {
    return { messages: 0, lastMessages: incoming };
  }
  if (incoming >= prevLast) {
    return {
      messages: prevAccum + (incoming - prevLast),
      lastMessages: incoming,
    };
  }
  return { messages: prevAccum + incoming, lastMessages: incoming };
}

export function upsertSighting(
  prev: AntennaSighting | undefined,
  ac: AntennaSnapshotAc,
  now: number,
): AntennaSighting | null {
  const hex = normalizeHex(ac.hex);
  if (!hex) return null;

  const flight = normalizeFlight(ac.flight);
  const alt = finiteNumber(ac.alt_baro);
  const dst = finiteNumber(ac.r_dst);
  const dir = finiteNumber(ac.r_dir);
  const messagesIn = finiteNumber(ac.messages);
  const category =
    typeof ac.category === 'string' ? ac.category.trim() : '';

  if (!prev) {
    const msg = accumulateMessages(null, messagesIn, 0);
    return {
      hex,
      firstSeen: now,
      lastSeen: now,
      flights: flight ? [flight] : [],
      lastFlight: flight,
      closestNm: dst,
      closestDir: dst != null ? dir : null,
      closestAt: dst != null ? now : null,
      altMin: alt,
      altMax: alt,
      category,
      hits: 1,
      messages: msg.messages,
      lastMessages: msg.lastMessages,
    };
  }

  const msg = accumulateMessages(prev.lastMessages, messagesIn, prev.messages);
  const closer = dst != null && (prev.closestNm == null || dst < prev.closestNm);
  return {
    hex,
    firstSeen: prev.firstSeen,
    lastSeen: now,
    flights: mergeFlights(prev.flights, flight),
    lastFlight: flight || prev.lastFlight,
    closestNm: closer ? dst : prev.closestNm,
    closestDir: closer ? dir : prev.closestDir,
    closestAt: closer ? now : prev.closestAt,
    altMin: alt == null ? prev.altMin : Math.min(prev.altMin ?? alt, alt),
    altMax: alt == null ? prev.altMax : Math.max(prev.altMax ?? alt, alt),
    category: category || prev.category,
    hits: prev.hits + 1,
    messages: msg.messages,
    lastMessages: msg.lastMessages,
  };
}

export function applySnapshot(
  byHex: Record<string, AntennaSighting>,
  aircraft: AntennaSnapshotAc[],
  now: number,
): { byHex: Record<string, AntennaSighting>; upserted: number } {
  const next = { ...byHex };
  let upserted = 0;
  for (const ac of aircraft) {
    const hex = normalizeHex(ac.hex);
    if (!hex) continue;
    const updated = upsertSighting(next[hex], ac, now);
    if (!updated) continue;
    next[hex] = updated;
    upserted += 1;
  }
  return { byHex: next, upserted };
}
