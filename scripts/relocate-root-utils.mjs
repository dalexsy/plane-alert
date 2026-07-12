#!/usr/bin/env node
/** Move loose src/app/utils/* into subfolders (component-budget helper gate). */
import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UTIL_ROOT = join(ROOT, 'src', 'app', 'utils');
const SRC = join(ROOT, 'src');

const moves = [];
for (const name of readdirSync(UTIL_ROOT)) {
  if (!/\.(ts|js)$/.test(name)) continue;
  const full = join(UTIL_ROOT, name);
  if (!statSync(full).isFile()) continue;
  const stem = name.replace(/\.(util|ts|js)$/, '').replace(/\./g, '-');
  const folder = stem.endsWith('-util') ? stem.slice(0, -5) : stem;
  const destDir = join(UTIL_ROOT, folder === 'units' ? 'units' : folder);
  const destFile = join(destDir, name);
  if (join(UTIL_ROOT, name) === destFile) continue;
  if (!statSync(destDir, { throwIfNoEntry: false })?.isDirectory()) {
    mkdirSync(destDir, { recursive: true });
  }
  renameSync(full, destFile);
  moves.push({ folder, name });
  console.log(`moved ${name} -> ${folder}/${name}`);
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (/\.(ts|html|scss)$/.test(entry)) {
      out.push(full);
    }
  }
}

const files = [];
walk(SRC, files);

for (const file of files) {
  let text = readFileSync(file, 'utf8');
  let changed = false;
  for (const { folder, name } of moves) {
    const oldTail = `utils/${name}`;
    const newTail = `utils/${folder}/${name}`;
    if (!text.includes(oldTail)) continue;
    text = text.split(oldTail).join(newTail);
    changed = true;
  }
  if (changed) writeFileSync(file, text);
}

console.log(`utils relocation done (${moves.length} files)`);
