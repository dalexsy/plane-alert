import { PlaneLogEntry } from '../../components/results-overlay/results-overlay.component';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import type { AutoFollowConfig } from './auto-follow.service';

export function getFilteredPlanesForAutoFollow(
  planeList: PlaneLogEntry[],
  config: AutoFollowConfig,
): PlaneLogEntry[] {
  return planeList.filter((plane) => {
    if (plane.lat == null || plane.lon == null) {
      return false;
    }
    if (plane.filteredOut) {
      return false;
    }
    if (plane.isUnknown) {
      return false;
    }
    if (config.excludeGrounded && plane.onGround) {
      return false;
    }
    if (plane.altitude != null && plane.altitude < config.minAltitude) {
      return false;
    }
    return true;
  });
}

export function applyMilitaryPriorityPool(
  pool: PlaneLogEntry[],
  militaryPriority: boolean,
  excludeIcao?: string | null,
): PlaneLogEntry[] {
  if (!militaryPriority) {
    return pool;
  }

  const priority = pool.filter((p) => p.isMilitary || p.isSpecial);
  if (priority.length === 0) {
    return pool;
  }

  if (priority.length > 1 && excludeIcao) {
    const filtered = priority.filter((p) => p.icao !== excludeIcao);
    return filtered.length > 0 ? filtered : priority;
  }

  return priority;
}

export function pickRandomPlaneFromPool(pool: PlaneLogEntry[]): PlaneLogEntry {
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

export function pickNearestPlaneFromPool(
  pool: PlaneLogEntry[],
  centerLat: number,
  centerLon: number,
): PlaneLogEntry {
  return pool.reduce((prev, curr) => {
    const prevDist = haversineDistance(
      centerLat,
      centerLon,
      prev.lat!,
      prev.lon!,
    );
    const currDist = haversineDistance(
      centerLat,
      centerLon,
      curr.lat!,
      curr.lon!,
    );
    return currDist < prevDist ? curr : prev;
  });
}
