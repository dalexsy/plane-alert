import * as L from 'leaflet';
import { haversineDistance } from '../../utils/geo-utils/geo-utils';
import { toggleAirportColor } from './airport-toggle.util';
import { fetchOverpassJson } from './overpass-fetch.util';
import type { AirportService } from './airport.service';

export type AirportDisplayCtx = AirportService;

export const MAJOR_AIRPORT_RADIUS_KM = 5;
export const MINOR_AIRPORT_RADIUS_KM = 1;

export function buildAerodromeQuery(radiusMeters: number, lat: number, lon: number): string {
  return `
    [out:json][timeout:25];
    (
      node["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
      way["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
      relation["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
    );
    out center;
  `;
}

export function addAirportCircle(
  ctx: AirportDisplayCtx,
  airportId: number,
  airportLat: number,
  airportLon: number,
  name: string,
  code: string,
  showLabels: boolean,
  useKm: number,
): void {
  const isClicked = ctx.clickedAirports.has(airportId);
  const circleColor = isClicked ? 'gold' : 'cyan';
  const fillPattern = isClicked
    ? 'url(#airportStripedPatternGold)'
    : 'url(#airportStripedPatternCyan)';

  const circle = L.circle([airportLat, airportLon], {
    radius: useKm * 1000,
    color: circleColor,
    weight: 2,
    fill: true,
    fillColor: fillPattern,
    fillOpacity: 0.3,
    className: 'airport-radius',
    interactive: true,
  }).addTo(ctx.map);

  circle.on('click', () => toggleAirportColor(ctx, airportId));
  circle.bindTooltip(name, {
    direction: 'center',
    className: 'airport-tooltip',
    opacity: 0.8,
    offset: [0, 0],
    permanent: showLabels,
  });

  ctx.airportCircles.set(airportId, circle);
  if (!ctx.airportRadiusCache.has(airportId)) {
    ctx.airportRadiusCache.set(airportId, useKm);
  }
}

export async function applyRunwayRadii(
  ctx: AirportDisplayCtx,
  radiusKm: number,
): Promise<void> {
  if (ctx.airportCircles.size === 0) {
    return;
  }

  const airportList = Array.from(ctx.airportCircles.entries()).map(
    ([id, circle]) => ({
      id,
      lat: circle.getLatLng().lat,
      lon: circle.getLatLng().lng,
      hasIata: !!ctx.airportData.get(id)?.code,
    }),
  );

  const lats = airportList.map((a) => a.lat);
  const lons = airportList.map((a) => a.lon);
  const minLat = Math.min(...lats) - radiusKm / 111;
  const maxLat = Math.max(...lats) + radiusKm / 111;
  const minLon = Math.min(...lons) - radiusKm / 111;
  const maxLon = Math.max(...lons) + radiusKm / 111;

  const runwayQuery = `
    [out:json][timeout:25];
    (
      way["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
      node["aeroway"="runway"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out geom;
  `;

  const data = await fetchOverpassJson(runwayQuery).catch(() => null);
  if (!data?.elements) {
    return;
  }

  const lengthsByAirport = new Map<number, number>();
  for (const raw of data.elements) {
    const elem = raw as { geometry?: Array<{ lat: number; lon: number }> };
    const coords = elem.geometry;
    if (!coords || coords.length < 2) {
      continue;
    }

    const start = coords[0];
    const end = coords[coords.length - 1];
    const lenKm = haversineDistance(start.lat, start.lon, end.lat, end.lon);

    let bestId: number | null = null;
    let bestDist = Infinity;
    airportList.forEach((a) => {
      const d = haversineDistance(
        a.lat,
        a.lon,
        (start.lat + end.lat) / 2,
        (start.lon + end.lon) / 2,
      );
      if (d < bestDist) {
        bestDist = d;
        bestId = a.id;
      }
    });

    if (bestId != null) {
      const prev = lengthsByAirport.get(bestId) || 0;
      lengthsByAirport.set(bestId, Math.max(prev, lenKm));
    }
  }

  airportList.forEach((a) => {
    const circle = ctx.airportCircles.get(a.id);
    const maxLen = lengthsByAirport.get(a.id) || 0;
    const radius =
      maxLen > 0
        ? maxLen / 2 + 0.5
        : a.hasIata
          ? MAJOR_AIRPORT_RADIUS_KM
          : MINOR_AIRPORT_RADIUS_KM;
    ctx.airportRadiusCache.set(a.id, radius);
    if (circle) {
      circle.setRadius(radius * 1000);
    }
  });
}
