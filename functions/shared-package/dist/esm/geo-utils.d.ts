/**
 * Geographic and mathematical utility functions
 */
/**
 * Converts degrees to radians
 */
export declare function toRadians(deg: number): number;
/**
 * Converts radians to degrees
 */
export declare function toDegrees(rad: number): number;
/**
 * Calculates the distance between two geographic points using the Haversine formula
 *
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export declare function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Computes the bearing from one geographic point to another
 *
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Bearing in degrees (0-360)
 */
export declare function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Converts a bearing in degrees to a cardinal direction
 *
 * @param bearing Bearing in degrees (0-360)
 * @returns Cardinal direction (N, NNE, NE, etc.)
 */
export declare function bearingToCardinal(bearing: number): string;
/**
 * Formats a distance value with appropriate unit
 *
 * @param km Distance in kilometers
 * @param unit Desired output unit ('km' or 'miles')
 * @returns Formatted distance with unit
 */
export declare function formatDistance(km: number, unit: 'km' | 'miles'): {
    value: number;
    unit: string;
};
//# sourceMappingURL=geo-utils.d.ts.map