/**
 * Speed unit conversions for tooltip display
 */

import { DistanceUnit } from '../units-distance/units-distance.util';

export function knotsToMs(knots: number): number {
  return knots * 0.514444;
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function msToMph(ms: number): number {
  return ms * 2.23694;
}

export function convertSpeedForTooltip(
  speedMs: number,
  userDistanceUnit: DistanceUnit,
): { value: number; label: string } {
  if (userDistanceUnit === DistanceUnit.MILES) {
    const mph = msToMph(speedMs);
    const rounded = Math.round(mph);
    return { value: rounded, label: 'mph' };
  }
  const kmh = msToKmh(speedMs);
  const rounded = Math.round(kmh);
  return { value: rounded, label: 'km/h' };
}
