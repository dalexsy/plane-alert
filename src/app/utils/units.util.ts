/**
 * Utility functions for unit conversions between metric and imperial systems
 */

export enum DistanceUnit {
  KILOMETERS = 'km',
  MILES = 'miles',
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
 * Convert kilometers to feet
 */
export function kmToFeet(km: number): number {
  // 1 km = 3280.8398950131 feet (exact conversion)
  return km * 3280.8398950131;
}

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  // 1 meter = 3.28084 feet (exact conversion)
  return meters * 3.28084;
}

/**
 * Convert feet to meters
 */
export function feetToMeters(feet: number): number {
  // 1 foot = 0.3048 meters (exact conversion)
  return feet * 0.3048;
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

/**
 * Convert distance from kilometers to feet for tooltip display
 * This is used when the user has selected miles as their unit preference
 */
export function convertKmToTooltipDistance(
  km: number,
  userUnit: DistanceUnit
): { value: number; label: string } {
  if (userUnit === DistanceUnit.MILES) {
    // Use feet for tooltips when user prefers imperial
    const feet = kmToFeet(km);
    const rounded = Math.round(feet);
    return { value: rounded, label: 'ft' };
  } else {
    // Use meters when user prefers metric
    const meters = Math.round(km * 1000);
    return { value: meters, label: 'm' };
  }
}

/**
 * Convert altitude from meters to the appropriate unit based on distance preference
 * When user prefers miles, show altitude in feet; when km, show in meters
 */
export function convertAltitudeForTooltip(
  altitudeMeters: number,
  userDistanceUnit: DistanceUnit
): { value: number; label: string } {
  if (userDistanceUnit === DistanceUnit.MILES) {
    // Use feet for altitude when user prefers imperial
    const feet = metersToFeet(altitudeMeters);
    const rounded = Math.round(feet);
    return { value: rounded, label: 'ft' };
  } else {
    // Use meters when user prefers metric
    const rounded = Math.round(altitudeMeters);
    return { value: rounded, label: 'm' };
  }
}

/**
 * Format distance with proper decimal separator (always period, not comma)
 * This ensures consistent formatting regardless of user locale
 */
export function formatDistance(distance: number): string {
  // Round to 1 decimal place
  const rounded = Math.round(distance * 10) / 10;

  // Manual formatting to ensure period as decimal separator
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 10);

  // Always show one decimal place
  const formatted =
    decimalPart === 0 ? `${integerPart}.0` : `${integerPart}.${decimalPart}`;

  return formatted;
}

/**
 * Convert meters per second to kilometers per hour
 */
export function msToKmh(ms: number): number {
  // 1 m/s = 3.6 km/h
  return ms * 3.6;
}

/**
 * Convert meters per second to miles per hour
 */
export function msToMph(ms: number): number {
  // 1 m/s = 2.23694 mph
  return ms * 2.23694;
}

/**
 * Convert speed from m/s to the appropriate unit based on distance preference
 * When user prefers miles, show speed in mph; when km, show in km/h
 */
export function convertSpeedForTooltip(
  speedMs: number,
  userDistanceUnit: DistanceUnit
): { value: number; label: string } {
  if (userDistanceUnit === DistanceUnit.MILES) {
    // Use mph for speed when user prefers imperial
    const mph = msToMph(speedMs);
    const rounded = Math.round(mph);
    return { value: rounded, label: 'mph' };
  } else {
    // Use km/h when user prefers metric
    const kmh = msToKmh(speedMs);
    const rounded = Math.round(kmh);
    return { value: rounded, label: 'km/h' };
  }
}
