#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SVC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'services');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
}

const files = [];
walk(SVC, files);

for (const file of files) {
  const dir = dirname(file);
  let text = readFileSync(file, 'utf8');
  const orig = text;

  text = text.replace(
    /from ['"]\.\.\/([a-z0-9-]+)\/([a-z0-9-]+)\.(service|util)['"]/g,
    (match, folder, mod, ext) => {
      const local = join(dir, `${mod}.${ext}.ts`);
      if (existsSync(local)) return `from './${mod}.${ext}'`;
      const parentLocal = join(dirname(dir), folder, `${mod}.${ext}.ts`);
      if (existsSync(parentLocal) && folder === mod) return `from '../${folder}/${mod}.${ext}'`;
      return match;
    },
  );

  text = text.replace(/\/([a-z0-9-]+)\/\1\/\1/g, '/$1/$1');

  if (text !== orig) writeFileSync(file, text);
}

console.log('fixed co-located service folder imports');
