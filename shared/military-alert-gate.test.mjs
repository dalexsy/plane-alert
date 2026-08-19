import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { shouldAlertForAircraft } = require('./dist/cjs/index.js');

const kingDesc = 'Lockheed Martin HC-130J Combat King II';

test('HC-130J Combat King with t=C30J should alert', () => {
  assert.equal(
    shouldAlertForAircraft({
      hex: 'AE5F15',
      flight: 'KING11',
      t: 'C30J',
      desc: kingDesc,
      dbFlags: 1,
    }),
    true,
  );
});

test('HC-130J Combat King without type should alert from desc', () => {
  assert.equal(
    shouldAlertForAircraft({
      hex: 'AE5F15',
      flight: 'KING11',
      desc: kingDesc,
      dbFlags: 1,
    }),
    true,
  );
});

test('RCH C-17 Globemaster should alert', () => {
  assert.equal(
    shouldAlertForAircraft({
      hex: 'AE04AC',
      flight: 'RCH5040',
      t: 'C17',
      dbFlags: 1,
    }),
    true,
  );
});

test('TEX2 trainer stays boring', () => {
  assert.equal(
    shouldAlertForAircraft({
      hex: 'AE1F00',
      flight: 'HUNT11',
      t: 'TEX2',
      desc: 'Beechcraft T-6 Texan II',
      dbFlags: 1,
    }),
    false,
  );
});

test('King Air stays boring (not Combat King)', () => {
  assert.equal(
    shouldAlertForAircraft({
      hex: 'AE1234',
      flight: 'PAT123',
      t: 'BE20',
      desc: 'Beechcraft Super King Air 200',
      dbFlags: 1,
    }),
    false,
  );
});
