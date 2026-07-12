#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function listServiceStems() {
  const base = join(SRC, 'app', 'services');
  const stems = new Set();
  for (const name of readdirSync(base)) {
    const full = join(base, name);
    if (statSync(full).isDirectory()) stems.add(name);
  }
  return [...stems].sort((a, b) => b.length - a.length);
}

function listUtilFiles() {
  const base = join(SRC, 'app', 'utils');
  const map = new Map();
  function walk(dir, rel) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, rel ? `${rel}/${name}` : name);
      else if (name.endsWith('.ts')) map.set(name.replace(/\.ts$/, ''), rel ? `${rel}/${name}` : name);
    }
  }
  walk(base, '');
  return map;
}

const serviceStems = listServiceStems();
const utilMap = listUtilFiles();

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (/\.ts$/.test(entry)) out.push(full);
  }
}

const files = [];
walk(SRC, files);

let total = 0;
for (const file of files) {
  let text = readFileSync(file, 'utf8');
  const orig = text;

  for (const stem of serviceStems) {
    const re = new RegExp(`(services/${stem})\\.service`, 'g');
    text = text.replace(re, `$1/${stem}.service`);
    text = text.replace(
      new RegExp(`from ['"]((?:\\.\\.\\/)+)${stem}\\.service['"]`, 'g'),
      `from '$1${stem}/${stem}.service'`,
    );
  }

  const fileDir = dirname(file).replace(/\\/g, '/');
  const servicesIdx = fileDir.indexOf('/services/');
  if (servicesIdx >= 0) {
    const relFromServices = fileDir.slice(servicesIdx + '/services/'.length);
    const depth = relFromServices.split('/').filter(Boolean).length;
    const up = depth ? '../'.repeat(depth) : './';
    text = text.replace(/from ['"]\.\/([a-z0-9-]+)\.service['"]/g, (match, stem) => {
      if (relFromServices.split('/')[0] === stem) return match;
      return `from '${up}${stem}/${stem}.service'`;
    });
  }

  for (const [mod, relPath] of utilMap) {
    const withoutExt = relPath.replace(/\.ts$/, '');
    const re = new RegExp(`utils/${mod}(?!/)(?!/${mod})`, 'g');
    text = text.replace(re, `utils/${withoutExt}`);
  }

  // undo accidental triple nesting from repeated runs
  text = text.replace(/utils\/([a-z0-9-]+)\/\1\/\1/g, 'utils/$1/$1');

  if (text !== orig) {
    writeFileSync(file, text);
    total++;
  }
}

console.log(`fixed imports in ${total} files`);
