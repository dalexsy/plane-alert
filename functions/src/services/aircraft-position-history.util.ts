import type { AdsBPlane } from '@plane-alert/shared';

export type PositionHistory = Record<
  string,
  Array<{ lat: number; lon: number; timestamp: number }>
>;

export function buildPositionHistory(
  validAircraft: AdsBPlane[],
  existingHistory: PositionHistory,
): PositionHistory {
  const now = Date.now();
  const history: PositionHistory = {};

  validAircraft.forEach((plane) => {
    const icao = plane.hex?.toUpperCase();
    if (
      !icao ||
      typeof plane.lat !== 'number' ||
      typeof plane.lon !== 'number'
    ) {
      return;
    }

    const planeHistory = existingHistory[icao] || [];

    planeHistory.push({
      lat: plane.lat,
      lon: plane.lon,
      timestamp: now,
    });

    history[icao] = planeHistory.slice(-20);
  });

  return history;
}
