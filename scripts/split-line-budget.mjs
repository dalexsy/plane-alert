/**
 * Split oversized plane-alert files for max-lines / component-budget compliance.
 * Run: node scripts/split-line-budget.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('wrote', rel, content.split(/\r?\n/).length, 'lines');
}

// --- cone geo utils (pure functions) ---
write(
  'src/app/services/cone/cone-geo.util.ts',
  `import * as L from 'leaflet';

export function computeDestinationPoint(
  lat: number,
  lon: number,
  distanceKm: number,
  bearingDeg: number
): [number, number] {
  const R = 6371;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const dByR = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export function createRingSegment(
  lat: number,
  lon: number,
  startAngle: number,
  endAngle: number,
  innerKm: number,
  outerKm: number
): L.Polygon {
  const pts: L.LatLng[] = [];
  const step = 1;
  for (let angle = startAngle; angle <= endAngle; angle += step) {
    const [olat, olon] = computeDestinationPoint(lat, lon, outerKm, angle);
    pts.push(L.latLng(olat, olon));
  }
  if (endAngle - startAngle >= 360) {
    const outerRing: L.LatLng[] = [];
    for (let angle = 0; angle <= 360; angle += step) {
      const [olat, olon] = computeDestinationPoint(lat, lon, outerKm, angle);
      outerRing.push(L.latLng(olat, olon));
    }
    const innerRing: L.LatLng[] = [];
    for (let angle = 0; angle <= 360; angle += step) {
      const [ilat, ilon] = computeDestinationPoint(lat, lon, innerKm, angle);
      innerRing.push(L.latLng(ilat, ilon));
    }
    return L.polygon([outerRing, innerRing], {
      interactive: false,
      className: 'visual-cone',
      fill: true,
      stroke: true,
      weight: 1,
    });
  }
  for (let angle = endAngle; angle >= startAngle; angle -= step) {
    const [ilat, ilon] = computeDestinationPoint(lat, lon, innerKm, angle);
    pts.push(L.latLng(ilat, ilon));
  }
  pts.push(pts[0]);
  return L.polygon(pts, {
    interactive: false,
    className: 'visual-cone',
    fill: true,
    stroke: true,
    weight: 1.5,
  });
}
`
);

// --- rain calc utils ---
write(
  'src/app/services/rain/rain-calc.util.ts',
  read('src/app/services/rain.service.ts')
    .slice(
      read('src/app/services/rain.service.ts').indexOf('export interface RainConfiguration'),
      read('src/app/services/rain.service.ts').indexOf('@Injectable')
    )
    .trim() +
    `\n\nimport type { RainConfiguration, RainDrop, WeatherRainMapping } from './rain-types';

export function shouldActivateRain(condition: string, description: string): boolean {
  return (
    condition.includes('rain') ||
    condition.includes('drizzle') ||
    condition.includes('thunderstorm') ||
    description.includes('rain') ||
    description.includes('drizzle') ||
    description.includes('shower')
  );
}
`
);

console.log('split-line-budget.mjs partial — run manual rain/cone component updates');
