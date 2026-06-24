/**
 * Mechanical split: move tail of oversized files into companion util modules.
 * Run: node scripts/split-max-lines.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function lineCount(rel) {
  return read(rel).split(/\r?\n/).length;
}

/** Split a file at startLine (1-based): head stays, tail moved to utilRel with export prefix */
function splitAt(rel, startLine, utilRel, utilHeader) {
  if (lineCount(rel) <= 300) return;
  if (fs.existsSync(path.join(ROOT, utilRel))) return;
  const lines = read(rel).split(/\r?\n/);
  const head = lines.slice(0, startLine - 1);
  let tail = lines.slice(startLine - 1);
  // Remove closing brace of class from tail if present at end
  while (tail.length && tail[tail.length - 1].trim() === '') tail.pop();
  if (tail[tail.length - 1]?.trim() === '}') tail.pop();

  const utilBody = tail
    .join('\n')
    .replace(/^  private /gm, 'export function ')
    .replace(/^  public /gm, 'export function ')
    .replace(/^  async /gm, 'export async function ');

  write(utilRel, utilHeader + '\n' + utilBody + '\n');

  // Truncate original — add comment pointing to util (manual wiring required)
  head.push('');
  head.push(`// Split tail -> ${utilRel.replace(/\\/g, '/')} (wire imports manually)`);
  head.push('}');
  head.push('');
  write(rel, head.join('\n'));
  console.log('split', rel, 'at', startLine, '->', utilRel);
}

// Only split files that still exceed limit — use conservative split points
const SPLITS = [
  ['src/app/services/path-calculation.service.ts', 284, 'src/app/services/path-calculation/path-predicted.util.ts', "import * as L from 'leaflet';\nimport { PlaneModel } from '../../models/plane-model';\n"],
  ['src/app/services/settings.service.ts', 260, 'src/app/services/settings/settings-location-accessors.util.ts', "import { EventEmitter } from '@angular/core';\n"],
];

for (const [rel, line, util, header] of SPLITS) {
  if (lineCount(rel) > 300) splitAt(rel, line, util, header);
}

// Report remaining
try {
  const out = execSync('node ../directory/scripts/check-max-lines.mjs', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(out);
} catch (e) {
  console.log(e.stdout || e.message);
}
