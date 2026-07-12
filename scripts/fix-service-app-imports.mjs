#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVC = join(ROOT, 'src', 'app', 'services');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
}

const files = [];
walk(SVC, files);

const APP_PREFIXES = ['models/', 'components/', 'config/', 'types/', 'map/', 'directives/'];

for (const file of files) {
  const rel = relative(SVC, file).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  if (depth === 0) continue;

  let text = readFileSync(file, 'utf8');
  const orig = text;
  const up = '../'.repeat(depth + 1);

  for (const prefix of APP_PREFIXES) {
    text = text.replace(new RegExp(`from ['"]\\.\\./${prefix.replace('/', '\\/')}`, 'g'), `from '${up}${prefix}`);
  }

  text = text.replace(/from ['"]\.\.\/utils\//g, `from '${up}utils/`);

  text = text.replace(/svg-utils\/svg-utils\/svg-utils/g, 'svg-utils/svg-utils');

  if (text !== orig) writeFileSync(file, text);
}

console.log('fixed app-root import depths in services/');
