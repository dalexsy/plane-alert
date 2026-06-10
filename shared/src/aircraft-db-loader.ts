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
export function createAircraftLookupMap(
  dbArray: Array<AircraftDbEntry | AircraftDbMetadata>
): Map<string, AircraftDbEntry> {
  const lookup = new Map<string, AircraftDbEntry>();

  // Skip first element if it's metadata (has 'note' or 'version' fields)
  const startIndex =
    dbArray.length > 0 &&
    ('note' in dbArray[0] ||
      'version' in dbArray[0] ||
      'exported' in dbArray[0])
      ? 1
      : 0;

  for (let i = startIndex; i < dbArray.length; i++) {
    const entry = dbArray[i] as AircraftDbEntry;
    if (entry.icao) {
      lookup.set(entry.icao.toUpperCase(), entry);
    }
  }

  return lookup;
}

/**
 * Checks if an aircraft is military based on database entry
 */
export function isAircraftMilitary(
  icao: string,
  dbLookup: Map<string, AircraftDbEntry>
): boolean {
  const entry = dbLookup.get(icao.toUpperCase());
  return entry?.mil === true;
}

/**
 * Enhanced military detection that checks both database and API flags
 */
export function isMilitaryAircraft(
  icao: string,
  apiMilFlag: boolean | undefined,
  apiDbFlags: number | undefined,
  dbLookup: Map<string, AircraftDbEntry>
): boolean {
  // 1. Check user database first (highest priority)
  const dbEntry = dbLookup.get(icao.toUpperCase());
  if (dbEntry !== undefined) {
    return dbEntry.mil === true;
  }

  // 2. Fall back to API flags
  return apiMilFlag === true || apiDbFlags === 1;
}
