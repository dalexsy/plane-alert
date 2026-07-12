#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'services', 'map');

for (const name of readdirSync(MAP_DIR)) {
  if (!name.endsWith('.ts')) continue;
  const file = join(MAP_DIR, name);
  let text = readFileSync(file, 'utf8');
  const stem = name.replace(/\.(util|service)\.ts$/, '').replace(/\.ts$/, '');

  text = text.replace(
    new RegExp(`from ['"]\\.\\./${stem.replace(/-/g, '\\-')}/${stem.replace(/-/g, '\\-')}\\.(service|util)['"]`, 'g'),
    `from './${name.replace(/\.ts$/, '')}'`,
  );

  text = text.replace(
    /from ['"]\.\.\/map-([a-z-]+)\/map-\1\.service['"]/g,
    "from './map-$1.service'",
  );

  text = text.replace(
    /from ['"]\.\.\/map-bootstrap\/map-bootstrap\.service['"]/g,
    "from './map-bootstrap.service'",
  );

  text = text.replace(
    /from ['"]\.\.\/\.\.\/map\/map\.service['"]/g,
    "from './map.service'",
  );

  writeFileSync(file, text);
}

const geoCache = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'app',
  'services',
  'geocoding-cache',
  'geocoding-cache.service.ts',
);
if (existsSync(geoCache)) {
  let t = readFileSync(geoCache, 'utf8');
  t = t.replace(
    "from './geocoding/geocoding-fetch.util'",
    "from '../geocoding/geocoding-fetch.util'",
  );
  writeFileSync(geoCache, t);
}

const planeModel = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'app',
  'models',
  'plane-model.ts',
);
let pm = readFileSync(planeModel, 'utf8');
pm = pm.replace(
  "from '../../utils/plane-marker/plane-marker'",
  "from '../utils/plane-marker/plane-marker'",
);
writeFileSync(planeModel, pm);

console.log('fixed map/ co-located imports');
