#!/usr/bin/env node
/**
 * One-time helper: extracts map.component.ts body into services + thin shell.
 * Run: node scripts/split-map-component.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_TS = join(ROOT, 'src/app/map/map.component.ts');
const SVC_DIR = join(ROOT, 'src/app/services/map');

if (!existsSync(SVC_DIR)) mkdirSync(SVC_DIR, { recursive: true });

const src = readFileSync(MAP_TS, 'utf8');
const classMatch = src.match(
  /export class MapComponent[\s\S]*?\n\}\s*$/
);
if (!classMatch) {
  console.error('MapComponent class not found');
  process.exit(1);
}

const classBody = classMatch[0];

/** Extract methods by name from class body */
function extractMethod(name, isPrivate = false) {
  const prefix = isPrivate ? `private ${name}` : name;
  const re = new RegExp(
    `(  (?:/\\*\\*[\\s\\S]*?\\*/\\s*)?(?:private |public |protected )?(?:async )?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\n  \\})`,
    'm'
  );
  const m = classBody.match(re);
  return m ? m[1] : null;
}

const methodNames = [
  'ngAfterViewInit',
  'ngOnDestroy',
  'onZoomIn',
  'onZoomOut',
  'onToggleAirportLabels',
  'setCurrentAsHome',
  'goToHome',
  'updateMap',
  'getWindFromDirection',
  'convertWindSpeed',
  'getCurrentWindSpeed',
  'getCurrentWindUnit',
  'cycleWindUnit',
  'removeOutOfRangePlanes',
  'reverseGeocode',
  'findPlanes',
  'clearSeenList',
  'exportFilterList',
  'useCurrentLocation',
  'resolveAndUpdateFromAddress',
  'onExcludeDiscountChange',
  'toggleConeVisibility',
  'onConeConfigChange',
  'onConeConfig',
  'setCloudOpacity',
  'setRainOpacity',
  'toggleCloudCover',
  'toggleRainCover',
  'centerOnPlane',
  'followNearestPlane',
  'onCenterAirport',
  'onWindowResize',
  'onHoverOverlayPlane',
  'onUnhoverOverlayPlane',
  'onUpdateNow',
  'onToggleDateTimeOverlays',
  'onToggleAltitudeBorders',
  'onToggleAnimations',
  'onToggleWindDirection',
  'onToggleSunDirection',
  'getMoonBackgroundColor',
  'getMoonLitColor',
  'onWindowViewToggle',
  'toggleBrightness',
];

const privateMethods = [
  'addressLooksWrongForCoordinates',
  'handleFollowStateChange',
  'handleFollowRequest',
  'setHomeMarker',
  'updateFavicon',
  'applySkyColorsToCloudLayer',
  'createCloudLayerFilter',
  'extractRgbFromColor',
  'calculateHueShift',
  'unhighlightPlane',
];

const extracted = {};
for (const n of methodNames) {
  extracted[n] = extractMethod(n);
}
for (const n of privateMethods) {
  extracted[n] = extractMethod(n, true);
}

const missing = Object.entries(extracted).filter(([, v]) => !v);
if (missing.length) {
  console.warn('Could not extract:', missing.map(([k]) => k).join(', '));
}

console.log('Extracted', Object.keys(extracted).filter((k) => extracted[k]).length, 'methods');
console.log('Manual refactor still required — use as reference for line ranges.');
