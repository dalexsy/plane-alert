/**
 * Country detection logic for aircraft based on ICAO hex codes and registration prefixes
 */
import type { CountryDetectionResult } from './types';
/**
 * ICAO lookup configuration
 */
export declare const ICAO_LOOKUP_CONFIG: {
    readonly enableIcaoLookup: true;
    readonly cacheMaxAge: number;
    readonly caseInsensitive: true;
};
/**
 * Gets country from ICAO 24-bit address using comprehensive range data
 */
export declare function getCountryFromIcaoHex(icaoHex: string): CountryDetectionResult;
/**
 * Gets country from aircraft registration prefix
 */
export declare function getCountryFromRegistration(registration: string): CountryDetectionResult;
/**
 * Determines the country of origin for an aircraft with priority system
 *
 * Priority (highest to lowest):
 * 1. For military aircraft: ICAO hex (more reliable for military)
 * 2. Registration prefix lookup
 * 3. For civilian aircraft: ICAO hex lookup
 * 4. API-provided country
 */
export declare function getAircraftCountry(registration?: string, icaoHex?: string, apiCountry?: string, isMilitary?: boolean): CountryDetectionResult;
/**
 * Gets a list of all known registration prefixes for a country
 */
export declare function getRegistrationPrefixesForCountry(countryCode: string): string[];
/**
 * Validates if a country code is known in our registration database
 */
export declare function isKnownCountry(countryCode: string): boolean;
//# sourceMappingURL=country-detection.d.ts.map