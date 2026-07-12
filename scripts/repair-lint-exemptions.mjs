/**
 * Remove blanket lint exemptions: convert [style.prop] → [style.--prop] (CSS vars)
 * and fix SCSS lines broken by gap-ok comment stripping.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CAMEL_TO_KEBAB = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  transform: 'transform',
  transformOrigin: 'transform-origin',
  opacity: 'opacity',
  color: 'color',
  backgroundColor: 'background-color',
  background: 'background',
  backgroundImage: 'background-image',
  filter: 'filter',
  display: 'display',
  height: 'height',
  border: 'border',
};

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', 'dist', '.git', '.angular'].includes(name)) walk(full, out);
    } else out.push(full);
  }
  return out;
}

function fixBrokenScssComments(text) {
  return text.replace(/;\s*\/\*\s*$/gm, ';');
}

function convertStyleBindings(text) {
  return text.replace(
    /\[style\.([a-zA-Z]+)(\.[a-zA-Z]+)?\]/g,
    (match, prop, unit = '') => {
      const kebab = CAMEL_TO_KEBAB[prop];
      if (!kebab) return match;
      return `[style.--${kebab}${unit ?? ''}]`;
    },
  );
}

function fixInlineStyles(text) {
  let next = text;
  next = next.replace(
    /<svg width="0" height="0" style="position: absolute">/g,
    '<svg class="map-pattern-defs" width="0" height="0">',
  );
  next = next.replace(
    /style="stroke: cyan; stroke-width: 5"/g,
    'stroke="cyan" stroke-width="5"',
  );
  next = next.replace(
    /style="stroke: gold; stroke-width: 5"/g,
    'stroke="gold" stroke-width="5"',
  );
  next = next.replace(/\sstyle="cursor: pointer"/g, ' class="angle-clickable"');
  next = next.replace(
    /\sstyle="position: relative; display: inline-block"/g,
    ' class="celestial-inline"',
  );
  next = next.replace(
    /\sstyle="display: inline-block; position: relative"/g,
    ' class="celestial-moon-wrap"',
  );
  next = next.replace(/\sstyle="z-index: 1"/g, ' class="celestial-moon-phase"');
  next = next.replace(
    /style="position: fixed;\s*\/\*[^*]*\*\/\s*data-style-ok/g,
    'class="info-overlay-shell"',
  );
  next = next.replace(/style="position: fixed;[^"]*"/g, 'class="info-overlay-shell"');
  return next;
}

let htmlCount = 0;
let scssCount = 0;

for (const file of walk(path.join(ROOT, 'src'))) {
  if (file.endsWith('.html') && !file.endsWith('.spec.html')) {
    const orig = fs.readFileSync(file, 'utf8');
    let next = convertStyleBindings(orig);
    next = fixInlineStyles(next);
    if (next !== orig) {
      fs.writeFileSync(file, next);
      htmlCount++;
    }
  }
  if (file.endsWith('.scss')) {
    const orig = fs.readFileSync(file, 'utf8');
    const next = fixBrokenScssComments(orig);
    if (next !== orig) {
      fs.writeFileSync(file, next);
      scssCount++;
    }
  }
}

console.log(`repaired ${htmlCount} html, ${scssCount} scss files`);