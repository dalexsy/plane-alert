/**
 * Bulk split oversized plane-alert source files for line-budget compliance.
 * Run once: node scripts/bulk-split-budget.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('wrote', rel, content.split(/\r?\n/).length, 'lines');
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// --- generate-missing-icao-ranges.js: move constants to lib ---
{
  const src = read('scripts/generate-missing-icao-ranges.js');
  const marker = 'const EXPECTED_EUROPEAN_COUNTRIES';
  const idx = src.indexOf(marker);
  const funcIdx = src.indexOf('function analyzeGlobalGaps');
  const constants = src.slice(idx, funcIdx);
  write(
    'scripts/lib/icao-expected-european-countries.js',
    constants.trim() + '\nmodule.exports = { EXPECTED_EUROPEAN_COUNTRIES };\n'
  );
  const header = src.slice(0, idx);
  const body = src.slice(funcIdx);
  write(
    'scripts/generate-missing-icao-ranges.js',
    header +
      "const { EXPECTED_EUROPEAN_COUNTRIES } = require('./lib/icao-expected-european-countries');\n\n" +
      body
  );
}

// --- settings.service.ts split ---
{
  const src = read('src/app/services/settings.service.ts');
  const loadIdx = src.indexOf('  load(): void {');
  const beforeLoad = src.slice(0, loadIdx);
  const loadBody = src.slice(loadIdx);

  // Extract ViewConeConfig + display prefs (lines before location getters at setLocationWithAddress)
  const locMarker = '  get lat(): number | null {';
  const displayPart = beforeLoad.slice(0, beforeLoad.indexOf(locMarker));
  const locationPart = beforeLoad.slice(beforeLoad.indexOf(locMarker));

  write(
    'src/app/services/settings/settings-display-prefs.service.ts',
    `import { Injectable, EventEmitter } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsDisplayPrefsService {
${displayPart
  .replace(/^\/\*[\s\S]*?\*\/\n/, '')
  .replace(/^import[\s\S]*?export interface ViewConeConfig[\s\S]*?\}\n\n/, '')
  .replace(/^@Injectable[\s\S]*?export class SettingsService \{\n/, '')
  .replace(/  constructor\(\) \{[\s\S]*?  \}\n/, '')}`
  );

  write(
    'src/app/services/settings/settings-location-prefs.service.ts',
    `import { Injectable, EventEmitter } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsLocationPrefsService {
${locationPart.trim()}\n}`
  );

  write(
    'src/app/services/settings/settings-load.util.ts',
    loadBody
      .replace(/^  load\(\): void \{/, 'export function loadSettings(store: SettingsStore): void {')
      .replace(/\n\}$/, '\n}\n')
  );

  console.log('settings split stubs written — manual facade merge still needed');
}

console.log('bulk-split-budget.mjs done (partial)');
