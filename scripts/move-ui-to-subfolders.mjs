/**
 * Move flat ui/*.component.* into ui/<name>/ subfolders and fix imports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.join(ROOT, 'src/app/components/ui');

const COMPONENTS = [
  'button',
  'clock',
  'icon',
  'tab',
  'input',
  'temperature',
  'location-button',
];

function moveComponent(name) {
  const sub = path.join(UI, name);
  fs.mkdirSync(sub, { recursive: true });
  for (const ext of ['.ts', '.html', '.scss', '.spec.ts']) {
    const from = path.join(UI, `${name}.component${ext}`);
    const to = path.join(sub, `${name}.component${ext}`);
    if (fs.existsSync(from)) {
      let content = fs.readFileSync(from, 'utf8');
      if (ext === '.ts') {
        content = content.replace(
          `./${name === 'button' || name === 'clock' || name === 'input' || name === 'temperature' ? 'icon' : name}.component`,
          (m) => m.replace('./', '../')
        );
        content = content.replace(
          "from './icon.component'",
          "from '../icon/icon.component'"
        );
        content = content.replace(
          "styleUrls: ['./button.component.scss']",
          "styleUrls: ['./button.component.scss']"
        );
        content = content.replace(
          "templateUrl: './",
          "templateUrl: './"
        );
      }
      fs.writeFileSync(to, content);
      fs.unlinkSync(from);
      console.log('moved', path.relative(ROOT, from), '->', path.relative(ROOT, to));
    }
  }
}

for (const name of COMPONENTS) {
  moveComponent(name);
}

const importMap = {
  'button.component': 'button/button.component',
  'clock.component': 'clock/clock.component',
  'icon.component': 'icon/icon.component',
  'tab.component': 'tab/tab.component',
  'input.component': 'input/input.component',
  'temperature.component': 'temperature/temperature.component',
  'location-button.component': 'location-button/location-button.component',
};

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(full);
    } else if (ent.name.endsWith('.ts')) {
      let src = fs.readFileSync(full, 'utf8');
      let changed = false;
      for (const [oldPath, newPath] of Object.entries(importMap)) {
        const re = new RegExp(
          `(from ['"]\\.\\.\\/ui\\/)${oldPath.replace('.', '\\.')}(['"])`,
          'g'
        );
        if (re.test(src)) {
          src = src.replace(re, `$1${newPath}$2`);
          changed = true;
        }
        const re2 = new RegExp(
          `(from ['"]\\.\\.\\/\\.\\.\\/components\\/ui\\/)${oldPath.replace('.', '\\.')}(['"])`,
          'g'
        );
        if (re2.test(src)) {
          src = src.replace(re2, `$1${newPath}$2`);
          changed = true;
        }
        const re3 = new RegExp(
          `(from ['"]\\.\\.\\/components\\/ui\\/)${oldPath.replace('.', '\\.')}(['"])`,
          'g'
        );
        if (re3.test(src)) {
          src = src.replace(re3, `$1${newPath}$2`);
          changed = true;
        }
      }
      // intra-ui imports
      for (const [oldPath, newPath] of Object.entries(importMap)) {
        const re = new RegExp(
          `(from ['"]\\./)${oldPath.replace('.', '\\.')}(['"])`,
          'g'
        );
        if (full.includes(`${path.sep}ui${path.sep}`) && re.test(src)) {
          src = src.replace(re, `(from '../${newPath.split('/')[0]}/${oldPath}$2`);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, src);
        console.log('updated imports in', path.relative(ROOT, full));
      }
    }
  }
}

walk(path.join(ROOT, 'src'));

// Fix button -> icon import inside button folder
const buttonTs = path.join(UI, 'button/button.component.ts');
if (fs.existsSync(buttonTs)) {
  let b = fs.readFileSync(buttonTs, 'utf8');
  b = b.replace("from './icon.component'", "from '../icon/icon.component'");
  fs.writeFileSync(buttonTs, b);
}

console.log('ui subfolder move done');
