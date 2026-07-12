/**
 * Move nested component subtrees to top-level components/ (component-budget feature trees).
 * Run: node scripts/relocate-component-subtrees.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'src/app/components');

/** @type {{ from: string; to: string }[]} */
const MOVES = [
  {
    from: 'window-view-overlay/aircraft-container',
    to: 'aircraft-container',
  },
  {
    from: 'window-view-overlay/swallow-animation',
    to: 'swallow-animation',
  },
  {
    from: 'window-view-overlay/fall-leaves-animation',
    to: 'fall-leaves-animation',
  },
  {
    from: 'window-view-overlay/celestial-objects',
    to: 'celestial-objects',
  },
  {
    from: 'window-view-overlay/compass-labels',
    to: 'compass-labels',
  },
  {
    from: 'window-view-overlay/marker-lines',
    to: 'marker-lines',
  },
  {
    from: 'window-view-overlay/sky-background',
    to: 'sky-background',
  },
  {
    from: 'window-view-overlay/sun-sky-gradient',
    to: 'sun-sky-gradient',
  },
  {
    from: 'results-overlay/results-toolbar',
    to: 'results-toolbar',
  },
  {
    from: 'results-overlay/results-seen-list',
    to: 'results-seen-list',
  },
  {
    from: 'plane-list-item/plane-list-item-bottom',
    to: 'plane-list-item-bottom',
  },
  {
    from: 'input-overlay/input-overlay-form',
    to: 'input-overlay-form',
  },
];

function walkTs(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walkTs(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function depthFromComponents(file) {
  const rel = path.relative(COMPONENTS, file);
  return rel.split(path.sep).length - 1;
}

function fixImportDepth(content, delta) {
  if (delta === 0) return content;
  const re = /from ['"]((?:\.\.\/)+)([^'"]+)['"]/g;
  return content.replace(re, (match, dots, rest) => {
    const n = (dots.match(/\.\.\//g) || []).length;
    const adjusted = n - delta;
    if (adjusted <= 0) return match;
    return `from '${'../'.repeat(adjusted)}${rest}'`;
  });
}

for (const { from, to } of MOVES) {
  const src = path.join(COMPONENTS, from);
  const dest = path.join(COMPONENTS, to);
  if (!fs.existsSync(src)) {
    console.warn('skip missing', from);
    continue;
  }
  if (fs.existsSync(dest)) {
    console.warn('skip existing dest', to);
    continue;
  }
  fs.renameSync(src, dest);
  console.log('moved', from, '→', to);

  const delta = 1;
  for (const file of walkTs(dest)) {
    const text = fs.readFileSync(file, 'utf8');
    const fixed = fixImportDepth(text, delta, 0);
    if (fixed !== text) fs.writeFileSync(file, fixed);
  }
}

/** Parent imports: ./child/ → ../sibling/ */
const PARENT_IMPORTS = [
  {
    file: 'window-view-overlay/window-view-overlay.component.ts',
    replacements: [
      ['./sky-background/', '../sky-background/'],
      ['./sun-sky-gradient/', '../sun-sky-gradient/'],
      ['./celestial-objects/', '../celestial-objects/'],
      ['./compass-labels/', '../compass-labels/'],
      ['./marker-lines/', '../marker-lines/'],
      ['./dim-overlay/', './dim-overlay/'],
      ['./altitude-bands/', './altitude-bands/'],
      ['./aircraft-container/', '../aircraft-container/'],
      ['./swallow-animation/', '../swallow-animation/'],
      ['./fall-leaves-animation/', '../fall-leaves-animation/'],
    ],
  },
  {
    file: 'results-overlay/results-overlay.component.ts',
    replacements: [
      ['./results-toolbar/', '../results-toolbar/'],
      ['./results-seen-list/', '../results-seen-list/'],
      ['./results-sky-list/', './results-sky-list/'],
    ],
  },
  {
    file: 'plane-list-item/plane-list-item.component.ts',
    replacements: [
      ['./plane-list-item-bottom/', '../plane-list-item-bottom/'],
      ['./plane-list-item-top/', './plane-list-item-top/'],
    ],
  },
  {
    file: 'input-overlay/input-overlay.component.ts',
    replacements: [
      ['./input-overlay-form/', '../input-overlay-form/'],
      ['./input-overlay-toggles/', './input-overlay-toggles/'],
    ],
  },
];

for (const { file, replacements } of PARENT_IMPORTS) {
  const full = path.join(COMPONENTS, file);
  if (!fs.existsSync(full)) continue;
  let text = fs.readFileSync(full, 'utf8');
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  fs.writeFileSync(full, text);
  console.log('updated imports in', file);
}

console.log('done');
