/**
 * Unit conversion utilities — re-exports distance and speed modules.
 */

export {
  DistanceUnit,
  kmToMiles,
  milesToKm,
  kmToFeet,
  metersToFeet,
  feetToMeters,
  convertFromKm,
  convertToKm,
  getDistanceUnitLabel,
  getDistanceUnitShortLabel,
  convertKmToTooltipDistance,
  convertAltitudeForTooltip,
  formatDistance,
  formatDistanceWithTenths,
} from '../units-distance/units-distance.util';

export {
  knotsToMs,
  msToKmh,
  msToMph,
  convertSpeedForTooltip,
} from '../units-speed/units-speed.util';
