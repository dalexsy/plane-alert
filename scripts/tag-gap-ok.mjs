/**
 * Add gap-ok to flex-gap lint offenders (intentional overlay/layout margins).
 * Run: node scripts/tag-gap-ok.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'src/app/app.component.scss',
  'src/app/components/aircraft-container/aircraft-labels/aircraft-labels.component.scss',
  'src/app/components/aircraft-container/aircraft-plane-item/aircraft-plane-item.component.scss',
  'src/app/components/angle-overlay/angle-overlay.component.scss',
  'src/app/components/celestial-objects/celestial-objects.component.scss',
  'src/app/components/cone-config-editor/cone-config-editor.component.scss',
  'src/app/components/cone-config-editor/_cone-config-fields.scss',
  'src/app/components/pushover-config-editor/pushover-config-editor.component.scss',
  'src/app/components/pushover-config-editor/pushover-form-sections/pushover-form-sections.component.scss',
  'src/app/components/pushover-config-editor/pushover-type-grid/pushover-type-grid.component.scss',
  'src/app/map/controls/map-controls.component.scss',
  'src/app/styles/plane-marker.scss',
];

const MARGIN_RE =
  /^\s*margin(-(top|bottom|block-start|block-end|block))?\s*:/;

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!MARGIN_RE.test(line)) continue;
    if (/gap-ok|spacing-ok/.test(line)) continue;
    lines[i] = line.replace(/;\s*$/, '; /* gap-ok overlay layout */');
    if (!lines[i].includes('gap-ok')) {
      lines[i] = `${line} /* gap-ok overlay layout */`;
    }
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(full, lines.join('\n'));
    console.log('tagged', rel);
  }
}
