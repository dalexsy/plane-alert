/**
 * Distance unit conversions between metric and imperial systems
 */

export enum DistanceUnit {
  KILOMETERS = 'km',
  MILES = 'miles',
}

export function kmToMiles(km: number): number {
  return km * 0.621371192;
}

export function milesToKm(miles: number): number {
  return miles * 1.609344;
}

export function kmToFeet(km: number): number {
  return km * 3280.8398950131;
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function feetToMeters(feet: number): number {
  return feet * 0.3048;
}

export function convertFromKm(km: number, unit: DistanceUnit): number {
  switch (unit) {
    case DistanceUnit.MILES:
      return kmToMiles(km);
    case DistanceUnit.KILOMETERS:
    default:
      return km;
  }
}

export function convertToKm(distance: number, unit: DistanceUnit): number {
  switch (unit) {
    case DistanceUnit.MILES:
      return milesToKm(distance);
    case DistanceUnit.KILOMETERS:
    default:
      return distance;
  }
}

export function getDistanceUnitLabel(unit: DistanceUnit): string {
  switch (unit) {
    case DistanceUnit.MILES:
      return 'miles';
    case DistanceUnit.KILOMETERS:
    default:
      return 'km';
  }
}

export function getDistanceUnitShortLabel(unit: DistanceUnit): string {
  switch (unit) {
    case DistanceUnit.MILES:
      return 'mi';
    case DistanceUnit.KILOMETERS:
    default:
      return 'km';
  }
}

export function convertKmToTooltipDistance(
  km: number,
  userUnit: DistanceUnit,
): { value: number; label: string } {
  if (userUnit === DistanceUnit.MILES) {
    const feet = kmToFeet(km);
    const rounded = Math.round(feet);
    return { value: rounded, label: 'ft' };
  }
  const meters = Math.round(km * 1000);
  return { value: meters, label: 'm' };
}

export function convertAltitudeForTooltip(
  altitudeMeters: number,
  userDistanceUnit: DistanceUnit,
): { value: number; label: string } {
  if (userDistanceUnit === DistanceUnit.MILES) {
    const feet = metersToFeet(altitudeMeters);
    const rounded = Math.round(feet);
    return { value: rounded, label: 'ft' };
  }
  const rounded = Math.round(altitudeMeters);
  return { value: rounded, label: 'm' };
}

export function formatDistance(distance: number): string {
  const rounded = Math.round(distance * 10) / 10;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 10);
  return decimalPart === 0 ? `${integerPart}` : `${integerPart}.${decimalPart}`;
}

export function formatDistanceWithTenths(distance: number): string {
  const rounded = Math.round(distance * 10) / 10;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 10);
  return decimalPart === 0 ? `${integerPart}.0` : `${integerPart}.${decimalPart}`;
}
