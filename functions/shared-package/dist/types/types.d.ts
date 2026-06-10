/**
 * Core type definitions for aircraft detection and classification
 */
/**
 * Result interface for country detection with confidence levels
 */
export interface CountryDetectionResult {
    countryCode: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'api' | 'registration' | 'military-pattern' | 'icao-hex' | 'unknown';
    metadata?: {
        registrationPrefix?: string;
        icaoAllocation?: {
            range: string;
            countryCode: string;
            isMilitary: boolean;
            source: string;
            countryName?: string;
        };
        militaryPattern?: string;
        coordinateBounds?: {
            latMin: number;
            latMax: number;
            lonMin: number;
            lonMax: number;
        };
    };
}
/**
 * Interface for comprehensive ICAO country ranges
 */
export interface IcaoCountryRange {
    startHex: string;
    finishHex: string;
    isMilitary: boolean;
    countryISO2: string;
    startDec?: number;
    finishDec?: number;
}
/**
 * Aircraft data from ADS-B API
 */
export interface AdsBPlane {
    hex: string;
    flight?: string;
    callsign?: string;
    desc?: string;
    t?: string;
    mil?: boolean;
    dbFlags?: number;
    category?: string;
    lat?: number;
    lon?: number;
    gs?: number;
    track?: number;
    alt_baro?: number | string;
    alt_geom?: number;
    baro_rate?: number;
    gnd?: boolean;
    opicao?: string;
    type?: string;
    squawk?: string;
    r?: string;
}
//# sourceMappingURL=types.d.ts.map