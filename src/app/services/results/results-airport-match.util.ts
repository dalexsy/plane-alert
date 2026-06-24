import * as L from 'leaflet';
import { haversineDistance } from '../../utils/geo-utils';
import type { PlaneLogEntry } from '../../types/plane-log-entry';

export function isPlaneAtClickedAirport(
  plane: PlaneLogEntry,
  clickedAirports: Set<number>,
  airportCircles: Map<number, L.Circle>
): boolean {
  if (!plane.airportName) return false;
  const meetsAirportCriteria =
    plane.onGround === true ||
    (plane.altitude != null && plane.altitude <= 200);
  if (!meetsAirportCriteria) return false;
  if (
    plane.lat == null ||
    plane.lon == null ||
    clickedAirports.size === 0 ||
    !airportCircles?.size
  ) {
    return false;
  }
  for (const [airportId, circle] of airportCircles.entries()) {
    if (!clickedAirports.has(airportId)) continue;
    const airportCenter = circle.getLatLng();
    const radiusKm = circle.getRadius() / 1000;
    const distance = haversineDistance(
      plane.lat,
      plane.lon,
      airportCenter.lat,
      airportCenter.lng
    );
    if (distance <= radiusKm) return true;
  }
  return false;
}
