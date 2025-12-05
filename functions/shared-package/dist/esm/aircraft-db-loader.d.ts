/**
 * Aircraft database loader and lookup utilities
 * Provides unified aircraft data access for frontend and backend
 */
export interface AircraftDbEntry {
    icao: string;
    reg?: string;
    icaotype?: string;
    year?: string;
    manufacturer?: string;
    model?: string;
    ownop?: string;
    faa_pia?: boolean;
    faa_ladd?: boolean;
    short_type?: string;
    mil?: boolean;
}
export interface AircraftDbMetadata {
    note?: string;
    version?: string;
    exported?: string;
}
/**
 * Creates a lookup map from aircraft database array
 * Skips metadata objects (first element) if present
 */
export declare function createAircraftLookupMap(dbArray: Array<AircraftDbEntry | AircraftDbMetadata>): Map<string, AircraftDbEntry>;
/**
 * Checks if an aircraft is military based on database entry
 */
export declare function isAircraftMilitary(icao: string, dbLookup: Map<string, AircraftDbEntry>): boolean;
/**
 * Enhanced military detection that checks both database and API flags
 */
export declare function isMilitaryAircraft(icao: string, apiMilFlag: boolean | undefined, apiDbFlags: number | undefined, dbLookup: Map<string, AircraftDbEntry>): boolean;
//# sourceMappingURL=aircraft-db-loader.d.ts.map