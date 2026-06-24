import * as L from 'leaflet';
import { PlaneModel } from '../../models/plane-model';
import { catmullRomPoint, smoothTrailPoints } from './path-geo.util';

export function updateHistoricalTrailSegments(
  map: L.Map,
  plane: PlaneModel,
  lat: number,
  lon: number,
  altitude: number | null,
  getColor: (alt: number) => string
): void {
  if (!plane.positionHistory || plane.positionHistory.length < 2) {
    plane.removeHistoryTrailSegments(map);
    return;
  }
  const rawHistory = plane.positionHistory.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    alt: p.altitude ?? 0,
  }));
  rawHistory.push({ lat, lon, alt: altitude ?? 0 });
  const smoothPoints = smoothTrailPoints(rawHistory.map((p) => [p.lat, p.lon] as [number, number]));
  if (smoothPoints.length < 2) {
    plane.removeHistoryTrailSegments(map);
    return;
  }
  plane.removeHistoryTrailSegments(map);
  const numSegments = smoothPoints.length - 1;
  for (let i = 0; i < numSegments; i++) {
    const p0 = smoothPoints[Math.max(0, i - 1)];
    const p1 = smoothPoints[i];
    const p2 = smoothPoints[i + 1];
    const p3 = smoothPoints[Math.min(smoothPoints.length - 1, i + 2)];
    const interpolated: L.LatLngExpression[] = [p1];
    for (let j = 1; j <= 6; j++) interpolated.push(catmullRomPoint(j / 6, p0, p1, p2, p3));
    const opacity = 0.05 + 0.65 * (i / (numSegments > 1 ? numSegments - 1 : 1));
    const segAlt1 = rawHistory[i]?.alt ?? 0;
    const segAlt2 = rawHistory[i + 1]?.alt ?? 0;
    let prevPt: L.LatLngExpression = interpolated[0];
    for (let k = 1; k < interpolated.length; k++) {
      const t = k / (interpolated.length - 1);
      const segColor = getColor(segAlt1 + (segAlt2 - segAlt1) * t);
      const segment = L.polyline([prevPt, interpolated[k]], {
        className: 'history-trail-segment',
        color: segColor,
        weight: 4,
        opacity,
        interactive: false,
      }).addTo(map);
      plane.historyTrailSegments!.push(segment);
      prevPt = interpolated[k];
    }
  }
}
