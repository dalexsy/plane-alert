/**
 * ICAO aircraft type code to readable model name mapping
 * Auto-generated from basic-ac-db files
 * DO NOT EDIT MANUALLY - regenerate with extract-aircraft-type-mappings.js
 */
export interface AircraftTypeName {
    code: string;
    name: string;
}
export declare const AIRCRAFT_TYPE_NAMES: readonly AircraftTypeName[];
/**
 * Convert ICAO aircraft type code to readable model name
 * @param icaoCode ICAO aircraft type designator (e.g., 'B738', 'A320')
 * @returns Readable aircraft model name or the original code if not found
 */
export declare function getAircraftTypeName(icaoCode: string): string;
//# sourceMappingURL=aircraft-type-names.d.ts.map