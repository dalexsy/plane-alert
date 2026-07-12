import * as L from 'leaflet';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import { isPlaneAtClickedAirport } from './results-airport-match.util';

const NEW_PLANE_MS = 60 * 1000;

export function buildPlaneComparator(
  centerLat: number,
  centerLon: number,
  militaryPriority: boolean,
  clickedAirports: Set<number>,
  airportCircles: Map<number, L.Circle>
): (a: PlaneLogEntry, b: PlaneLogEntry) => number {
  const byDistance = (a: PlaneLogEntry, b: PlaneLogEntry) =>
    haversineDistance(centerLat, centerLon, a.lat!, a.lon!) -
    haversineDistance(centerLat, centerLon, b.lat!, b.lon!);

  if (militaryPriority) {
    return (a, b) => {
      const aPriority = (a.isMilitary ? 4 : 0) + (a.isSpecial ? 4 : 0);
      const bPriority = (b.isMilitary ? 4 : 0) + (b.isSpecial ? 4 : 0);
      if (aPriority !== bPriority) return bPriority - aPriority;
      const aAt = isPlaneAtClickedAirport(a, clickedAirports, airportCircles);
      const bAt = isPlaneAtClickedAirport(b, clickedAirports, airportCircles);
      if (aAt !== bAt) return aAt ? -1 : 1;
      return byDistance(a, b);
    };
  }
  return (a, b) => {
    const aAt = isPlaneAtClickedAirport(a, clickedAirports, airportCircles);
    const bAt = isPlaneAtClickedAirport(b, clickedAirports, airportCircles);
    if (aAt !== bAt) return aAt ? -1 : 1;
    return byDistance(a, b);
  };
}

export function filterAndSortPlanes(
  planes: PlaneLogEntry[],
  comparator: (a: PlaneLogEntry, b: PlaneLogEntry) => number,
  highlightedIcao: string | null
): PlaneLogEntry[] {
  const filtered = planes.filter((p) => !p.filteredOut).sort(comparator);
  if (highlightedIcao) {
    const idx = filtered.findIndex((p) => p.icao === highlightedIcao);
    if (idx > 0) {
      const [followed] = filtered.splice(idx, 1);
      filtered.unshift(followed);
    }
  }
  return filtered;
}

export function clearExpiredNewFlags(planes: PlaneLogEntry[], now: number): void {
  for (const plane of planes) {
    if (plane.isNew && now - plane.firstSeen > NEW_PLANE_MS) {
      plane.isNew = false;
    }
  }
}

export function planeListHash(planes: PlaneLogEntry[]): string {
  return planes
    .map(
      (p) =>
        `${p.icao}:${p.model || ''}:${p.isMilitary ? 1 : 0}:${
          p.filteredOut ? 1 : 0
        }`
    )
    .join(',');
}

export function getTimeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  const minutes = Math.floor(diff / 60);
  if (diff < 60) return '<1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}
