/**
 * Aircraft database loader and lookup utilities
 * Provides unified aircraft data access for frontend and backend
 */
/**
 * Creates a lookup map from aircraft database array
 * Skips metadata objects (first element) if present
 */
export function createAircraftLookupMap(dbArray) {
    const lookup = new Map();
    // Skip first element if it's metadata (has 'note' or 'version' fields)
    const startIndex = dbArray.length > 0 &&
        ('note' in dbArray[0] || 'version' in dbArray[0] || 'exported' in dbArray[0])
        ? 1
        : 0;
    for (let i = startIndex; i < dbArray.length; i++) {
        const entry = dbArray[i];
        if (entry.icao) {
            lookup.set(entry.icao.toUpperCase(), entry);
        }
    }
    return lookup;
}
/**
 * Checks if an aircraft is military based on database entry
 */
export function isAircraftMilitary(icao, dbLookup) {
    const entry = dbLookup.get(icao.toUpperCase());
    return entry?.mil === true;
}
/**
 * Enhanced military detection that checks both database and API flags
 */
export function isMilitaryAircraft(icao, apiMilFlag, apiDbFlags, dbLookup) {
    // 1. Check user database first (highest priority)
    const dbEntry = dbLookup.get(icao.toUpperCase());
    if (dbEntry !== undefined) {
        return dbEntry.mil === true;
    }
    // 2. Fall back to API flags
    return apiMilFlag === true || apiDbFlags === 1;
}
//# sourceMappingURL=aircraft-db-loader.js.map