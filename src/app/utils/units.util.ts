/**
 * Utility functions for unit conversions between metric and imperial systems
 */

export enum DistanceUnit {
  KILOMETERS = 'km',
  MILES = 'miles'
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  // 1 km = 0.621371192 miles (exact conversion)
  return km * 0.621371192;
}

/**
 * Convert miles to kilometers  
 */
export function milesToKm(miles: number): number {
  // 1 mile = 1.609344 km (exact conversion)
  return miles * 1.609344;
}

/**
 * Convert distance from kilometers to the specified unit
 */
export function convertFromKm(km: number, unit: DistanceUnit): number {
  switch (unit) {
    case DistanceUnit.MILES:
      return kmToMiles(km);
    case DistanceUnit.KILOMETERS:
    default:
      return km;
  }
}

/**
 * Convert distance from the specified unit to kilometers
 */
export function convertToKm(distance: number, unit: DistanceUnit): number {
  switch (unit) {
    case DistanceUnit.MILES:
      return milesToKm(distance);
    case DistanceUnit.KILOMETERS:
    default:
      return distance;
  }
}

/**
 * Get display unit label
 */
export function getDistanceUnitLabel(unit: DistanceUnit): string {
  switch (unit) {
    case DistanceUnit.MILES:
      return 'miles';
    case DistanceUnit.KILOMETERS:
    default:
      return 'km';
  }
}

/**
 * Get short display unit label
 */
export function getDistanceUnitShortLabel(unit: DistanceUnit): string {
  switch (unit) {
    case DistanceUnit.MILES:
      return 'mi';
    case DistanceUnit.KILOMETERS:
    default:
      return 'km';
  }
}
