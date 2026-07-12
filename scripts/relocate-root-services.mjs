#!/usr/bin/env node
/** Move loose src/app/services/*.service.ts into co-located subfolders (component-budget helper gate). */
import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVC_ROOT = join(ROOT, 'src', 'app', 'services');
const SRC = join(ROOT, 'src');

const moves = [];
for (const name of readdirSync(SVC_ROOT)) {
  if (!name.endsWith('.service.ts') && !name.endsWith('.service.spec.ts')) continue;
  const full = join(SVC_ROOT, name);
  if (!statSync(full).isFile()) continue;
  const stem = name.replace(/\.service(\.spec)?\.ts$/, '');
  const destDir = join(SVC_ROOT, stem);
  const destFile = join(destDir, name);
  if (!statSync(destDir, { throwIfNoEntry: false })?.isDirectory()) {
    mkdirSync(destDir, { recursive: true });
  }
  if (full === destFile) continue;
  renameSync(full, destFile);
  moves.push({ stem, name });
  console.log(`moved ${name} -> ${stem}/${name}`);

  let inner = readFileSync(destFile, 'utf8');
  const prefix = `./${stem}/`;
  if (inner.includes(prefix)) {
    inner = inner.split(prefix).join('./');
    writeFileSync(destFile, inner);
  }
  const parenPrefix = `from '../${stem}/`;
  if (inner.includes(parenPrefix)) {
    inner = inner.split(parenPrefix).join(`from '../`);
    writeFileSync(destFile, inner);
  }
}

if (moves.length === 0) {
  console.log('no service files to relocate');
  process.exit(0);
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
  for (const { stem, name } of moves) {
    const oldTail = `services/${name}`;
    const newTail = `services/${stem}/${name}`;
    if (!text.includes(oldTail)) continue;
    text = text.split(oldTail).join(newTail);
    changed = true;
  }
  if (changed) writeFileSync(file, text);
}

console.log(`updated imports in ${files.length} files scanned`);
