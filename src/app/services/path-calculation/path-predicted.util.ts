import * as L from 'leaflet';
import { PlaneModel, PositionHistory } from '../../models/plane-model';
import {
  computeBearing,
  generateCurvedPath,
  generateStraightPath,
  processPathPoints,
} from './path-geo.util';
import { calculateTurnRate } from './path-turn.util';

const MAX_PATH_CACHE_ENTRIES = 128;

function prunePathCache(
  cache: Map<string, { timestamp: number; points: [number, number][] }>,
  now: number,
  maxAgeMs: number
): void {
  if (cache.size < MAX_PATH_CACHE_ENTRIES) return;
  for (const [key, entry] of cache) {
    if (now - entry.timestamp >= maxAgeMs) cache.delete(key);
  }
  if (cache.size >= MAX_PATH_CACHE_ENTRIES) cache.clear();
}

export function calculatePredictedPath(
  lat: number,
  lon: number,
  track: number,
  velocity: number,
  positionHistory: PositionHistory[],
  pathCache: Map<string, { timestamp: number; points: [number, number][] }>,
  cacheDuration: number
): [number, number][] {
  const now = Date.now();
  prunePathCache(pathCache, now, cacheDuration);
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${track},${Math.round(velocity ?? 0)}`;
  const cacheEntry = pathCache.get(key);
  if (cacheEntry && now - cacheEntry.timestamp < cacheDuration) return cacheEntry.points;
  const pathPoints: [number, number][] = [[lat, lon]];
  const turnRateData = calculateTurnRate(positionHistory, track);
  const usesTurnRate = Math.abs(turnRateData.turnRatePerMin) > 0.5;
  pathPoints.push(
    ...(usesTurnRate
      ? generateCurvedPath(lat, lon, track, velocity, 1, turnRateData.turnRatePerMin)
      : generateStraightPath(lat, lon, track, velocity, 1))
  );
  const processed = processPathPoints(pathPoints, usesTurnRate);
  pathCache.set(key, { timestamp: now, points: processed });
  return processed;
}

export function removePredictedPath(plane: PlaneModel, map: L.Map): void {
  if (plane.path) {
    map.removeLayer(plane.path);
    plane.path = undefined;
  }
  if (plane.predictedPathArrowhead) {
    map.removeLayer(plane.predictedPathArrowhead);
    plane.predictedPathArrowhead = undefined;
  }
}

export function updatePredictedPathPolyline(
  plane: PlaneModel,
  map: L.Map,
  pathPoints: [number, number][],
  color: string
): L.Polyline {
  if (plane.path) {
    plane.path.setLatLngs(pathPoints);
    plane.path.setStyle({ className: 'predicted-path-line', color });
  } else {
    plane.path = L.polyline(pathPoints, {
      className: 'predicted-path-line',
      color,
      interactive: false,
      pane: 'overlayPane',
    }).addTo(map);
  }
  updatePathArrowhead(plane, map, pathPoints, color);
  return plane.path;
}

export function updatePathArrowhead(
  plane: PlaneModel,
  map: L.Map,
  pathPoints: [number, number][],
  color: string
): void {
  if (pathPoints.length >= 2) {
    const endPoint = pathPoints[pathPoints.length - 1];
    const prevPoint = pathPoints[pathPoints.length - 2];
    const rotation = computeBearing(prevPoint[0], prevPoint[1], endPoint[0], endPoint[1]) - 90;
    const arrowheadIcon = L.divIcon({
      html: `<div style="transform: rotate(${rotation}deg); color: ${color};">▶</div>`,
      className: 'predicted-path-arrowhead',
      iconSize: [20, 20],
      iconAnchor: [11, 11],
    });
    if (plane.predictedPathArrowhead) {
      plane.predictedPathArrowhead.setLatLng(endPoint);
      plane.predictedPathArrowhead.setIcon(arrowheadIcon);
    } else {
      plane.predictedPathArrowhead = L.marker(endPoint, { icon: arrowheadIcon, interactive: false }).addTo(map);
    }
  } else if (plane.predictedPathArrowhead) {
    map.removeLayer(plane.predictedPathArrowhead);
    plane.predictedPathArrowhead = undefined;
  }
}
