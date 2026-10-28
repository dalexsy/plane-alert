import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNotificationBody,
  formatNotificationTitle,
  formatPlaceAndBearingFromHome,
  formatHeadingBound,
  joinNotificationParts,
} from '@plane-alert/shared';

describe('shared notification formatter (push copy)', () => {
  it('title prefixes flag and joins model with operator', () => {
    assert.equal(
      formatNotificationTitle('🇩🇪', 'Airbus A400M', 'GAF871', '3F717C', 'Luftwaffe'),
      '🇩🇪 Airbus A400M · Luftwaffe',
    );
  });

  it('place bearing uses quadrant symbol from bearing degrees', () => {
    assert.equal(formatPlaceAndBearingFromHome('Rudow', 'SE', 135), 'Rudow ◶ SE');
    assert.equal(formatPlaceAndBearingFromHome('Rudow', 'SE'), 'Rudow SE');
  });

  it('heading uses track arrow and 8-point cardinal', () => {
    assert.equal(formatHeadingBound(90), '⭢ E');
    assert.equal(formatHeadingBound(315), '⭦ NW');
  });

  it('joinNotificationParts skips empty segments', () => {
    assert.equal(
      joinNotificationParts(['Rudow ◶ SE', undefined, '7,600 m']),
      'Rudow ◶ SE · 7,600 m',
    );
  });

  it('formatNotificationBody compact example', () => {
    const body = formatNotificationBody({
      icao: '3F717C',
      callsign: 'GAF871',
      location: 'Rudow',
      direction: 'SE',
      bearing: 135,
      planeHeading: 90,
      altitude: 7600,
      altitudeUnit: 'm',
      verticalRate: 800,
      speed: 412,
      speedUnit: 'km/h',
      operator: 'Luftwaffe',
    });
    assert.equal(body, 'Rudow ◶ SE · ⭢ E · 7,600 m ↑');
  });

  it('drops coordinate-like locations', () => {
    const body = formatNotificationBody({
      icao: 'TEST',
      location: '52.5200, 13.4050',
      direction: 'E',
      bearing: 90,
      planeHeading: 90,
      altitude: 5000,
      altitudeUnit: 'm',
      speedUnit: 'km/h',
    });
    assert.equal(body, '◶ E · ⭢ E · 5,000 m');
  });
});
