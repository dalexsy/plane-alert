/**
 * Geographic and mathematical utility functions
 */

/**
 * Converts degrees to radians
 */
export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates the distance between two geographic points using the Haversine formula
 *
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes the bearing from one geographic point to another
 *
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Bearing in degrees (0-360)
 */
export function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Converts a bearing in degrees to a cardinal direction
 *
 * @param bearing Bearing in degrees (0-360)
 * @returns Cardinal direction (N, NNE, NE, etc.)
 */
export function bearingToCardinal(bearing: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(bearing / 22.5) % dirs.length;
  return dirs[index];
}

/**
 * Formats a distance value with appropriate unit
 *
 * @param km Distance in kilometers
 * @param unit Desired output unit ('km' or 'miles')
 * @returns Formatted distance with unit
 */
export function formatDistance(
  km: number,
  unit: 'km' | 'miles'
): { value: number; unit: string } {
  if (unit === 'miles') {
    const miles = km * 0.621371192;
    return { value: Math.round(miles * 10) / 10, unit: 'mi' };
  }
  return { value: Math.round(km * 10) / 10, unit: 'km' };
}
