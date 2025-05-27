import { computeBearing } from './geo-utils';
import { PositionHistory } from '../models/plane-model';

export interface WindowHistoryPosition {
  x: number; // percent horizontal position
  y: number; // percent vertical position
  timestamp: number;
}

/**
 * Compute historical window view positions from position history
 */
export function computeWindowHistoryPositions(
  history: PositionHistory[],
  centerLat: number,
  centerLon: number
): WindowHistoryPosition[] {
  return history.map((ph) => {
    const azimuth = computeBearing(centerLat, centerLon, ph.lat, ph.lon);
    const azimuthFromSouth = (azimuth + 180) % 360;
    const x = (azimuthFromSouth / 360) * 100;
    const y = (Math.min(ph.altitude ?? 0, 20000) / 20000) * 100;
    return { x, y, timestamp: ph.timestamp };
  });
}
