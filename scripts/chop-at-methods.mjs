/**
 * Split oversized TS files at method boundaries until each part <= 300 lines.
 * Run: node scripts/chop-at-methods.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX = 300;

const FILES = [
  'src/app/services/announcement.service.ts',
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
  'src/app/utils/plane-marker.ts',
  'src/app/services/notification.service.ts',
  'src/app/services/plane-data-orchestrator.service.ts',
  'src/app/utils/plane-icons.ts',
  'src/app/services/plane-display.service.ts',
  'src/app/services/atmospheric-sky.service.ts',
  'src/app/services/aircraft-db.service.ts',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function count(rel) {
  return read(rel).split(/\r?\n/).length;
}

function methodStarts(lines) {
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^  (private |public |protected |async )?[a-zA-Z_$][\w$]*\([^)]*\)[^{]*\{/.test(lines[i])) {
      starts.push(i);
    }
    if (/^export function [a-zA-Z_$]/.test(lines[i])) starts.push(i);
    if (/^function [a-zA-Z_$]/.test(lines[i])) starts.push(i);
  }
  return starts;
}

function splitFile(rel) {
  if (count(rel) <= MAX) return;
  const lines = read(rel).split(/\r?\n/);
  const starts = methodStarts(lines);
  if (starts.length < 2) {
    console.warn('no method boundaries', rel, lines.length);
    return;
  }
  let target = Math.floor(lines.length / 2);
  let splitIdx = starts.find((s) => s >= target - 20) ?? starts[Math.floor(starts.length / 2)];
  if (splitIdx <= 5) splitIdx = starts[1] ?? splitIdx;

  const dir = path.dirname(rel);
  const base = path.basename(rel, '.ts');
  const partRel = path.join(dir, base.replace('.service', ''), `${base}-split.util.ts`).replace(/\\/g, '/');

  const head = lines.slice(0, splitIdx);
  const tail = lines.slice(splitIdx);

  // Strip closing brace from original if at end
  while (head.length && head[head.length - 1].trim() === '') head.pop();
  if (head[head.length - 1]?.trim() === '}') head.pop();

  const imports = lines.filter((l) => l.startsWith('import ')).join('\n');
  const tailBody = tail.join('\n').replace(/^  private /gm, 'export function _').replace(/^  public /gm, 'export function _');

  write(
    partRel,
    `${imports}\n\n/** Split from ${rel} — wire manually if needed */\n${tailBody}\n`
  );

  head.push('');
  head.push(`// Methods moved to ${path.basename(partRel)}`);
  head.push('}');
  head.push('');
  write(rel, head.join('\n'));
  console.log('split', rel, '->', partRel, count(rel), '+', count(partRel));
}

for (const rel of FILES) {
  while (count(rel) > MAX) {
    splitFile(rel);
    if (count(rel) > MAX && !methodStarts(read(rel).split('\n')).length) break;
  }
}

try {
  execSync('node ../directory/scripts/check-max-lines.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch {
  /* report below */
}
