import * as L from 'leaflet';
import {
  ConeArcElements,
  ConeDrawContext,
  PracticalVisibilityBand,
  ViewConeConfig,
} from './cone-types';
import { computeDestinationPoint, createRingSegment } from './cone-geo.util';

const DISTANCES_KM = [5, 10, 20, 30, 40, 70];

export function buildVisibilityBands(
  getFillColor: (altM: number) => string
): PracticalVisibilityBand[] {
  const maxDistanceKm = DISTANCES_KM[DISTANCES_KM.length - 1];
  const maxPracticalAltitudeM = 10000;
  const C = maxPracticalAltitudeM / Math.pow(maxDistanceKm * 1000, 2);
  const bands: PracticalVisibilityBand[] = DISTANCES_KM.map((outerKm, i) => {
    const innerKm = i === 0 ? 0 : DISTANCES_KM[i - 1];
    const practicalAltM = C * Math.pow(outerKm * 1000, 2);
    return { innerKm, outerKm, practicalAltM };
  });
  bands.forEach((band) => {
    band.color = getFillColor(band.practicalAltM);
  });
  return bands;
}

export function resolveConeAngles(viewCones: ViewConeConfig[]): { start: number; end: number }[] {
  if (viewCones?.length) {
    return viewCones.map((cone) => ({ start: cone.startAngle, end: cone.endAngle }));
  }
  return [{ start: 0, end: 360 }];
}

export function drawVisualCones(ctx: ConeDrawContext): void {
  const { map } = ctx;
  ctx.visualCones.forEach((cone) => map.removeLayer(cone));
  ctx.visualCones.length = 0;

  const svg = map.getPanes().overlayPane.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return;

  ctx.arcElements.forEach(({ path, textGroup }) => {
    if (svg.contains(path)) svg.removeChild(path);
    if (svg.contains(textGroup)) svg.removeChild(textGroup);
  });
  ctx.arcElements.length = 0;

  const visibilityBands = buildVisibilityBands(ctx.getFillColor);
  const angles = resolveConeAngles(ctx.viewCones);

  angles.forEach(({ start, end }) => {
    for (let i = visibilityBands.length - 1; i >= 0; i--) {
      const band = visibilityBands[i];
      if (band.outerKm <= band.innerKm + 0.1) continue;
      const segment = createRingSegment(
        ctx.lat,
        ctx.lon,
        start,
        end,
        band.innerKm,
        band.outerKm
      );
      segment.setStyle({
        color: band.color!,
        fillColor: band.color!,
        fillOpacity: 0.2 * ctx.opacity,
        weight: 1.5,
        opacity: 0.6 * ctx.opacity,
        stroke: true,
      });
      segment.addTo(map);
      ctx.visualCones.push(segment);
      segment.bringToFront();
    }
  });

  svg.style.overflow = 'visible';

  if (ctx.viewCones?.length) {
    const ringRadiusKm = DISTANCES_KM[1];
    ctx.viewCones.forEach((cone) => {
      addTextArc(
        svg,
        map,
        cone.label,
        ctx.lat,
        ctx.lon,
        cone.startAngle - 10,
        cone.endAngle + 10,
        ringRadiusKm,
        '#fff',
        ctx.arcElements
      );
    });
  }
}

export function updateConeOpacity(
  ctx: ConeDrawContext,
  coneSvgGroupName: string
): void {
  const svg = ctx.map?.getPanes().overlayPane.querySelector('svg');
  const coneGroup = svg?.querySelector(`#${coneSvgGroupName}`) as SVGGElement | null;
  if (coneGroup) coneGroup.style.opacity = String(ctx.opacity);
  ctx.visualCones.forEach((segment) => {
    segment.setStyle({
      fillOpacity: 0.2 * ctx.opacity,
      opacity: 0.6 * ctx.opacity,
    });
  });
  ctx.arcElements.forEach(({ path, textGroup }) => {
    path.style.opacity = String(ctx.opacity);
    textGroup.style.opacity = String(ctx.opacity);
  });
}

export function addTextArc(
  svg: SVGSVGElement,
  map: L.Map,
  text: string,
  lat: number,
  lon: number,
  startAngle: number,
  endAngle: number,
  coneRadiusKm: number,
  color: string,
  arcElements: ConeArcElements[]
): void {
  const zoom = map.getZoom();
  const radiusKm = coneRadiusKm * 1.05 * Math.pow(8 / zoom, 2);
  const points: L.LatLng[] = [];
  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const [destLat, destLon] = computeDestinationPoint(lat, lon, radiusKm, angle);
    points.push(L.latLng(destLat, destLon));
  }
  const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const arcId = `arc-${text.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  arcPath.setAttribute('id', arcId);
  const pathD = points
    .map((point, i) => {
      const p = map.latLngToLayerPoint(point);
      return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    })
    .join(' ');
  arcPath.setAttribute('d', pathD);
  arcPath.setAttribute('fill', 'none');
  arcPath.setAttribute('stroke', 'none');
  svg.appendChild(arcPath);

  const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  const textPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
  textPathElement.setAttribute('href', `#${arcId}`);
  textPathElement.setAttribute('startOffset', '50%');
  textPathElement.setAttribute('text-anchor', 'middle');
  textPathElement.setAttribute('fill', color);
  textPathElement.setAttribute('font-size', '1rem');
  textPathElement.textContent = text;
  textElement.appendChild(textPathElement);
  svg.appendChild(textElement);
  arcElements.push({
    path: arcPath as SVGPathElement,
    textGroup: textElement as SVGElement,
  });
}

export function cleanupConeLayers(
  map: L.Map | undefined,
  visualCones: L.Polygon[],
  arcElements: ConeArcElements[],
  coneSvgGroupName: string
): void {
  if (!map) return;
  visualCones.forEach((cone) => map.removeLayer(cone));
  visualCones.length = 0;
  const svg = map.getPanes().overlayPane.querySelector('svg');
  if (svg) {
    arcElements.forEach(({ path, textGroup }) => {
      if (svg.contains(path)) svg.removeChild(path);
      if (svg.contains(textGroup)) svg.removeChild(textGroup);
    });
    const coneGroup = svg.querySelector(`#${coneSvgGroupName}`);
    if (coneGroup && svg.contains(coneGroup)) svg.removeChild(coneGroup);
  }
  arcElements.length = 0;
}
