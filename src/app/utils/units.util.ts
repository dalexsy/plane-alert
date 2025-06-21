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
 * Convert kilometers to feet
 */
export function kmToFeet(km: number): number {
  // 1 km = 3280.8398950131 feet (exact conversion)
  return km * 3280.8398950131;
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
export function convertKmToTooltipDistance(km: number, userUnit: DistanceUnit): { value: number; label: string } {
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
  const formatted = decimalPart === 0 
    ? `${integerPart}.0` 
    : `${integerPart}.${decimalPart}`;
  
  return formatted;
}
