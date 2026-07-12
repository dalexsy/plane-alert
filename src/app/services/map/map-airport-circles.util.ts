import * as L from 'leaflet';
import { ensureStripedPattern } from '../../utils/svg-utils/svg-utils';

export function addAirportCircleToMap(
  map: L.Map,
  airportCircles: Map<number, L.Circle>,
  id: number,
  coords: [number, number],
  radiusKm: number,
): void {
  if (airportCircles.has(id)) {
    return;
  }
  const circle = L.circle(coords, {
    radius: radiusKm * 1000,
    color: 'cyan',
    weight: 2,
    fill: true,
    fillColor: 'url(#airportStripedPattern)',
    fillOpacity: 0.8,
    interactive: false,
  }).addTo(map);
  const svg = map
    .getPanes()
    .overlayPane.querySelector('svg') as SVGSVGElement;
  ensureStripedPattern(svg, 'airportStripedPattern', 'cyan', 1.0);
  airportCircles.set(id, circle);
}

export function removeAirportCircleFromMap(
  map: L.Map,
  airportCircles: Map<number, L.Circle>,
  id: number,
): void {
  const circle = airportCircles.get(id);
  if (circle) {
    map.removeLayer(circle);
    airportCircles.delete(id);
  }
}

export function clearAirportCirclesOnMap(
  map: L.Map,
  airportCircles: Map<number, L.Circle>,
): void {
  airportCircles.forEach((circle) => map.removeLayer(circle));
  airportCircles.clear();
}
