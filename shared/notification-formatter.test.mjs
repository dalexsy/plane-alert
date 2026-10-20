import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  formatNotificationTitle,
  formatNotificationBody,
  formatPlaceAndBearingFromHome,
  formatHeadingBound,
  joinNotificationParts,
} = require('./dist/cjs/notification-formatter.js');

test('formatNotificationTitle — model and operator', () => {
  assert.equal(
    formatNotificationTitle(undefined, 'Airbus A400M', 'GAF871', '3F717C', 'Luftwaffe'),
    'Airbus A400M · Luftwaffe'
  );
});

test('formatNotificationTitle — model without operator', () => {
  assert.equal(
    formatNotificationTitle(undefined, 'Airbus A400M', 'GAF871', '3F717C'),
    'Airbus A400M'
  );
});

test('formatNotificationTitle — callsign when no model (operator not in title)', () => {
  assert.equal(
    formatNotificationTitle(undefined, undefined, 'GAF871', '3F717C', 'Luftwaffe'),
    'GAF871'
  );
});

test('formatNotificationTitle — operator alone when no model or callsign', () => {
  assert.equal(formatNotificationTitle(undefined, undefined, undefined, '3F717C', 'Luftwaffe'), 'Luftwaffe');
});

test('formatNotificationTitle — icao when only hex known', () => {
  assert.equal(formatNotificationTitle(undefined, undefined, undefined, '3f717c'), '3F717C');
});

test('formatNotificationTitle — neutral fallback', () => {
  assert.equal(formatNotificationTitle(undefined), 'Aircraft nearby');
});

test('formatNotificationTitle — ignores junk strings', () => {
  assert.equal(formatNotificationTitle(undefined, ' undefined ', 'GAF871'), 'GAF871');
});

test('formatPlaceAndBearingFromHome', () => {
  assert.equal(formatPlaceAndBearingFromHome('Rudow', 'SE'), 'Rudow SE');
  assert.equal(formatPlaceAndBearingFromHome('Rudow', undefined), 'Rudow');
  assert.equal(formatPlaceAndBearingFromHome(undefined, 'ne'), 'NE');
});

test('formatHeadingBound', () => {
  assert.equal(formatHeadingBound(95), 'E-bound');
  assert.equal(formatHeadingBound(225), 'SW-bound');
});

test('joinNotificationParts skips empty segments', () => {
  assert.equal(joinNotificationParts(['Rudow SE', undefined, '7,600 m']), 'Rudow SE · 7,600 m');
});

test('formatNotificationBody — full compact example', () => {
  const body = formatNotificationBody({
    icao: '3F717C',
    callsign: 'GAF871',
    location: 'Rudow',
    direction: 'SE',
    planeHeading: 90,
    altitude: 7600,
    altitudeUnit: 'm',
    verticalRate: 800,
    speed: 412,
    speedUnit: 'km/h',
    operator: 'Luftwaffe',
  });
  assert.equal(body, 'Rudow SE · E-bound · 7,600 m ↑');
});

test('formatNotificationBody — level flight omits vertical arrow', () => {
  const body = formatNotificationBody({
    icao: '3F717C',
    location: 'Rudow',
    direction: 'SE',
    planeHeading: 90,
    altitude: 7600,
    altitudeUnit: 'm',
    verticalRate: 0,
    speedUnit: 'km/h',
  });
  assert.equal(body, 'Rudow SE · E-bound · 7,600 m');
});

test('formatNotificationBody — partial body fields only', () => {
  assert.equal(
    formatNotificationBody({ icao: 'X', altitude: 5000, altitudeUnit: 'm', speedUnit: 'km/h' }),
    '5,000 m'
  );
  assert.equal(formatNotificationBody({ icao: 'X', speedUnit: 'km/h' }), '');
});

test('formatNotificationBody — drops coordinate-like locations', () => {
  const body = formatNotificationBody({
    icao: 'TEST',
    location: '52.5200, 13.4050',
    direction: 'E',
    planeHeading: 90,
    altitude: 5000,
    altitudeUnit: 'm',
    speedUnit: 'km/h',
  });
  assert.equal(body, 'E · E-bound · 5,000 m');
});
