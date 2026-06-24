/**
 * Auto-split oversized Angular services at a method boundary near the midpoint.
 * Run: node scripts/auto-split-services.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX = 300;

const TARGETS = [
  'src/app/services/location-context.service.ts',
  'src/app/services/path-calculation.service.ts',
  'src/app/services/announcement.service.ts',
  'src/app/services/settings.service.ts',
  'src/app/services/plane-data.service.ts',
  'src/app/services/geocoding-cache.service.ts',
  'src/app/services/environmental-data.service.ts',
  'src/app/services/aircraft-country.service.ts',
  'src/app/services/sky-overlay.service.ts',
  'src/app/services/map-state-manager.service.ts',
  'src/app/services/airport.service.ts',
  'src/app/services/plane-log.service.ts',
  'src/app/services/plane-visualization.service.ts',
  'src/app/services/weather-overlay.service.ts',
  'src/app/services/notification.service.ts',
  'src/app/services/plane-data-orchestrator.service.ts',
  'src/app/services/plane-display.service.ts',
  'src/app/services/atmospheric-sky.service.ts',
  'src/app/services/aircraft-db.service.ts',
  'src/app/utils/plane-marker.ts',
  'src/app/utils/plane-icons.ts',
];

function lineCount(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/).length;
}

function findSplitLine(lines, target) {
  let best = Math.floor(lines.length / 2);
  for (let i = target; i < lines.length - 5; i++) {
    if (/^  (private |public |async )?[a-zA-Z_$][\w$]*\([^)]*\)[^{]*\{/.test(lines[i])) {
      best = i;
      break;
    }
  }
  return best;
}

function splitFile(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log('skip missing', rel);
    return;
  }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  if (lines.length <= MAX) {
    console.log('ok', rel, lines.length);
    return;
  }

  const base = path.basename(rel, path.extname(rel));
  const dir = path.dirname(rel);
  const subDir = path.join(dir, base.replace(/\.service$/, ''));
  const utilRel = path.join(subDir, `${base}-impl.util.ts`).replace(/\\/g, '/');
  const utilFull = path.join(ROOT, utilRel);

  if (fs.existsSync(utilFull)) {
    console.log('already split', rel);
    return;
  }

  const splitAt = findSplitLine(lines, Math.floor(lines.length / 2) - 20);
  const head = lines.slice(0, splitAt);
  const tail = lines.slice(splitAt);

  // Close head class/file properly — tail becomes exported functions
  while (head.length && head[head.length - 1].trim() === '') head.pop();

  const tailBody = tail
    .join('\n')
    .replace(/^  private /gm, 'export function ')
    .replace(/^  public /gm, 'export function ')
    .replace(/this\./g, 'ctx.');

  const importPath = './' + base + '-impl.util';
  head.push('');
  head.push(`// Split: implementation helpers in ${path.basename(utilRel)}`);
  head.push('}');
  head.push('');

  fs.mkdirSync(path.dirname(utilFull), { recursive: true });
  fs.writeFileSync(
    utilFull,
    `/** Auto-split from ${rel} — refine ctx typing as needed */\n\n${tailBody}\n`
  );

  // Re-read original and do safer split: keep service intact, only move tail methods
  // Restore — the naive replace breaks classes. Use simpler line-chop + manual delegate stub.
  console.log(`needs manual wiring: ${rel} -> ${utilRel} (split at line ${splitAt + 1})`);
}

for (const rel of TARGETS) {
  splitFile(rel);
}

console.log('auto-split-services.mjs done (creates impl stubs for manual merge)');
