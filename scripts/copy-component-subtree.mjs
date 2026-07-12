import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'src/app/components');

function cpDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) cpDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function fixImports(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      fixImports(full);
      continue;
    }
    if (!name.endsWith('.ts')) continue;
    let text = fs.readFileSync(full, 'utf8');
    const next = text.replace(/from '((?:\.\.\/)+)/g, (m, dots) => {
      const n = (dots.match(/\.\.\//g) || []).length;
      if (n <= 1) return m;
      return `from '${'../'.repeat(n - 1)}`;
    });
    if (next !== text) fs.writeFileSync(full, next);
  }
}

const moves = [
  ['window-view-overlay/fall-leaves-animation', 'fall-leaves-animation'],
  ['input-overlay/input-overlay-form', 'input-overlay-form'],
];

for (const [from, to] of moves) {
  const src = path.join(COMPONENTS, from);
  const dest = path.join(COMPONENTS, to);
  if (!fs.existsSync(src)) {
    console.log('skip', from);
    continue;
  }
  if (fs.existsSync(dest)) {
    console.log('dest exists', to);
    continue;
  }
  cpDir(src, dest);
  fixImports(dest);
  console.log('copied', from, '→', to);
}
