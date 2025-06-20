import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import registrationCountryPrefix from '../../assets/data/registration-country-prefix.json';
import { ICAO_LOOKUP_CONFIG } from '../config/icao-allocations.config';

/**
 * IMPORTANT: ICAO Country Detection Best Practices
 *
 * When aircraft show wrong flags/countries, DO NOT add individual ICAO code overrides!
 * This is not scalable and creates technical debt.
 *
 * Instead, follow this debugging process:
 * 1. Convert ICAO hex to decimal to find which range it falls into
 * 2. Check the ICAO allocation ranges in /assets/data/icao-country-ranges.json
 * 3. Verify if the range allocation is correct according to official ICAO documents
 * 4. If the range is wrong, update the range data (proper solution)
 * 5. If it's a special case (military using non-standard ranges), add a new range entry
 *
 * Example: ICAO 4B7FAC was showing as Swedish but is Swiss military
 * - Convert: 4B7FAC = 4,947,884 decimal
 * - Found: Falls in range 4A0000-4BFFFF allocated to Sweden
 * - Solution: Split the range to allocate 4B7F00-4B7FFF to Swiss military
 *
 * This range-based approach scales properly and maintains data integrity.
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
    icaoAllocation?: any;
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
 * Interface for comprehensive ICAO country ranges from JSON file
 */
export interface IcaoCountryRange {
  startHex: string;
  finishHex: string;
  isMilitary: boolean;
  countryISO2: string;
  startDec?: number; // computed at load time
  finishDec?: number; // computed at load time
}

@Injectable({
  providedIn: 'root',
})
export class AircraftCountryService {
  private readonly REGISTRATION_COUNTRY_PREFIX: Record<string, string> =
    registrationCountryPrefix as Record<string, string>;
  private readonly lookupCache = new Map<
    string,
    { result: string; timestamp: number }
  >();
  // Comprehensive ICAO country ranges loaded from JSON
  private icaoCountryRanges: IcaoCountryRange[] = [];
  private icaoRangesLoaded = false;
  private icaoRangesPromise: Promise<void>;

  constructor(private http: HttpClient) {
    // Load comprehensive ICAO ranges on service initialization
    this.icaoRangesPromise = this.loadIcaoCountryRanges();
  }

  /**
   * Load comprehensive ICAO country ranges from JSON file
   */ private async loadIcaoCountryRanges(): Promise<void> {
    try {
      const rawRanges = await this.http
        .get<Omit<IcaoCountryRange, 'startDec' | 'finishDec'>[]>(
          '/assets/data/icao-country-ranges.json'
        )
        .toPromise();
      // Compute decimal values from hex
      this.icaoCountryRanges = (rawRanges || []).map((r) => ({
        ...r,
        startDec: parseInt(r.startHex, 16),
        finishDec: parseInt(r.finishHex, 16),
      }));
      this.icaoRangesLoaded = true;
    } catch (error) {
      this.icaoRangesLoaded = true; // Mark as loaded to prevent retries
    }
  }

  /**
   * Ensures ICAO ranges are loaded before proceeding
   */
  private async ensureRangesLoaded(): Promise<void> {
    if (!this.icaoRangesLoaded) {
      await this.icaoRangesPromise;
    }
  }
  /**
   * Determines the country of origin for an aircraft with detailed result information
   * @param registration Aircraft registration (tail number)
   * @param icaoHex ICAO 24-bit address in hex format
   * @param apiCountry Country code provided by API (if available)
   * @returns Detailed country detection result
   */
  getAircraftCountryDetailed(
    registration?: string,
    icaoHex?: string,
    apiCountry?: string
  ): CountryDetectionResult {
    // If ICAO ranges are not loaded yet, we'll use fallback for now
    // The async loading will complete eventually and cached results will be cleared

    // Second priority: Standard registration prefix lookup (most reliable for civilian)
    if (registration) {
      const regResult = this.getCountryFromRegistrationDetailed(registration);
      if (regResult.countryCode !== 'Unknown') {
        return regResult;
      }
    }

    // Fourth priority: ICAO hex lookup (enhanced with configuration)
    if (icaoHex && ICAO_LOOKUP_CONFIG.enableIcaoLookup) {
      const icaoResult = this.getCountryFromIcaoHexDetailed(icaoHex);
      if (icaoResult.countryCode !== 'Unknown') {
        return icaoResult;
      }
    }

    // Next priority: Use API-provided country if valid
    if (apiCountry && /^[A-Za-z]{2}$/.test(apiCountry)) {
      return {
        countryCode: apiCountry.toUpperCase(),
        confidence: 'high',
        source: 'api',
      };
    }

    // Log when country lookup fails to return a result
    const decimalValue = icaoHex ? parseInt(icaoHex, 16) : null;
    // console.log(
    //   `Aircraft country lookup failed - ICAO: ${icaoHex} (${decimalValue}), Registration: ${
    //     registration || 'none'
    //   }, API: ${apiCountry || 'none'}`
    // );

    return {
      countryCode: 'Unknown',
      confidence: 'low',
      source: 'unknown',
    };
  }
  /**
   * Legacy method for backward compatibility
   * @deprecated Use getAircraftCountryDetailed for better insights
   */
  getAircraftCountry(
    registration?: string,
    icaoHex?: string,
    apiCountry?: string
  ): string {
    const result = this.getAircraftCountryDetailed(
      registration,
      icaoHex,
      apiCountry
    );
    return result.countryCode;
  }
  // Military registration patterns removed - military aircraft are identified via API data

  /**
   * Gets country from aircraft registration prefix with detailed information
   */
  private getCountryFromRegistrationDetailed(
    registration: string
  ): CountryDetectionResult {
    const reg = registration.trim().toUpperCase();

    // Sort prefixes by length (longest first) to match most specific prefix
    const sortedPrefixes = Object.keys(this.REGISTRATION_COUNTRY_PREFIX).sort(
      (a, b) => b.length - a.length
    );

    for (const prefix of sortedPrefixes) {
      if (reg.startsWith(prefix)) {
        return {
          countryCode: this.REGISTRATION_COUNTRY_PREFIX[prefix],
          confidence: 'high',
          source: 'registration',
          metadata: {
            registrationPrefix: prefix,
          },
        };
      }
    } // Log when registration lookup fails    // console.log(
    //   `Registration lookup failed - ${reg} - no matching prefix found`
    // );

    return {
      countryCode: 'Unknown',
      confidence: 'low',
      source: 'unknown',
    };
  }
  /**
   * Gets country from ICAO 24-bit address using comprehensive JSON data
   */ private getCountryFromIcaoHexDetailed(
    icaoHex: string
  ): CountryDetectionResult {
    // Clean up ICAO hex - remove common prefixes like ~
    let cleanIcaoHex = icaoHex;
    if (icaoHex && icaoHex.startsWith('~')) {
      cleanIcaoHex = icaoHex.substring(1);
    }

    // Check cache first
    const cacheKey = `icao:${cleanIcaoHex.toLowerCase()}`;
    const cached = this.lookupCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.timestamp < ICAO_LOOKUP_CONFIG.cacheMaxAge
    ) {
      return {
        countryCode: cached.result,
        confidence: 'medium',
        source: 'icao-hex',
      };
    }

    // Validate hex format
    if (!cleanIcaoHex || !/^[0-9A-Fa-f]+$/.test(cleanIcaoHex)) {
      return {
        countryCode: 'Unknown',
        confidence: 'low',
        source: 'unknown',
      };
    }

    try {
      const icaoDec = parseInt(cleanIcaoHex, 16); // First try comprehensive JSON data if loaded (priority - more accurate)
      if (this.icaoRangesLoaded && this.icaoCountryRanges.length > 0) {
        for (const range of this.icaoCountryRanges) {
          if (icaoDec >= range.startDec! && icaoDec <= range.finishDec!) {
            // Cache the result
            this.lookupCache.set(cacheKey, {
              result: range.countryISO2,
              timestamp: Date.now(),
            });

            return {
              countryCode: range.countryISO2,
              confidence: 'high', // Higher confidence from comprehensive data
              source: 'icao-hex',
              metadata: {
                icaoAllocation: {
                  range: `${range.startHex}-${range.finishHex}`,
                  countryCode: range.countryISO2,
                  isMilitary: range.isMilitary,
                  source: 'comprehensive-json',
                },
              },
            };
          }
        }

        // Log when no match found in comprehensive data for unknown aircraft
        if (icaoHex.startsWith('2F4') || icaoHex.startsWith('~2F4')) {
          console.log(
            `No match for ICAO ${icaoHex} (${icaoDec}) in comprehensive ranges`
          );
        }
      }
    } catch (error) {
      console.warn('Error parsing ICAO hex:', icaoHex, error);
    }

    return {
      countryCode: 'Unknown',
      confidence: 'low',
      source: 'unknown',
    };
  }

  /**
   * Coordinate-based country detection configuration
   * These boundaries are approximate and used for airport locale detection
   */
  private readonly COORDINATE_COUNTRY_BOUNDARIES = [
    {
      countryCode: 'DE',
      name: 'Germany',
      bounds: { latMin: 47, latMax: 55, lonMin: 6, lonMax: 15 },
    },
    {
      countryCode: 'FR',
      name: 'France',
      bounds: { latMin: 42, latMax: 51, lonMin: -5, lonMax: 8 },
    },
    {
      countryCode: 'ES',
      name: 'Spain',
      bounds: { latMin: 36, latMax: 44, lonMin: -10, lonMax: 3 },
    },
    {
      countryCode: 'IT',
      name: 'Italy',
      bounds: { latMin: 36, latMax: 47, lonMin: 6, lonMax: 19 },
    },
    {
      countryCode: 'NL',
      name: 'Netherlands',
      bounds: { latMin: 50, latMax: 54, lonMin: 3, lonMax: 7 },
    },
  ];

  /**
   * Determines country from geographic coordinates
   * @param latitude Latitude coordinate
   * @param longitude Longitude coordinate
   * @returns Country detection result with coordinate-based source
   */
  getCountryFromCoordinates(
    latitude: number,
    longitude: number
  ): CountryDetectionResult {
    for (const boundary of this.COORDINATE_COUNTRY_BOUNDARIES) {
      const { bounds } = boundary;
      if (
        latitude >= bounds.latMin &&
        latitude <= bounds.latMax &&
        longitude >= bounds.lonMin &&
        longitude <= bounds.lonMax
      ) {
        return {
          countryCode: boundary.countryCode,
          confidence: 'medium',
          source: 'api', // Using 'api' as closest match since coordinates are external input
          metadata: {
            coordinateBounds: bounds,
          },
        };
      }
    }

    return {
      countryCode: 'Unknown',
      confidence: 'low',
      source: 'unknown',
    };
  }

  /**
   * Gets a list of all known registration prefixes for a country
   */
  getRegistrationPrefixesForCountry(countryCode: string): string[] {
    const prefixes: string[] = [];
    for (const [prefix, country] of Object.entries(
      this.REGISTRATION_COUNTRY_PREFIX
    )) {
      if (country === countryCode.toUpperCase()) {
        prefixes.push(prefix);
      }
    }
    return prefixes.sort();
  }

  /**
   * Validates if a country code is known in our registration database
   */
  isKnownCountry(countryCode: string): boolean {
    return Object.values(this.REGISTRATION_COUNTRY_PREFIX).includes(
      countryCode.toUpperCase()
    );
  }
  /**
   * Gets comprehensive information about an aircraft's country determination
   */
  getAircraftInfo(
    registration?: string,
    icaoHex?: string,
    apiCountry?: string
  ) {
    const result = this.getAircraftCountryDetailed(
      registration,
      icaoHex,
      apiCountry
    );

    return {
      ...result,
      diagnostics: {
        hasRegistration: !!registration,
        hasIcaoHex: !!icaoHex,
        hasApiCountry: !!apiCountry,
        registrationPrefixes:
          result.countryCode !== 'Unknown'
            ? this.getRegistrationPrefixesForCountry(result.countryCode)
            : [],
        icaoAllocations: [], // ICAO allocations now managed in JSON data file
      },
    };
  }

  /**
   * Clears the lookup cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.lookupCache.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return {
      size: this.lookupCache.size,
      maxAge: ICAO_LOOKUP_CONFIG.cacheMaxAge,
      entries: Array.from(this.lookupCache.entries()).map(([key, value]) => ({
        key,
        result: value.result,
        age: Date.now() - value.timestamp,
      })),
    };
  }
  /**
   * Debug method to check ICAO allocation for specific aircraft
   */
  debugIcaoAllocation(icaoHex: string): any {
    const icaoDec = parseInt(icaoHex, 16);

    // Check comprehensive ranges
    if (this.icaoRangesLoaded && this.icaoCountryRanges.length > 0) {
      console.log(
        `Checking ${this.icaoCountryRanges.length} comprehensive ranges...`
      );
      for (const range of this.icaoCountryRanges) {
        if (icaoDec >= range.startDec! && icaoDec <= range.finishDec!) {
          return {
            found: true,
            source: 'comprehensive',
            country: range.countryISO2,
            range: `${range.startHex}-${range.finishHex}`,
            isMilitary: range.isMilitary,
          };
        }
      }
    } else {
    } // No allocation found in JSON data
    console.log('❌ No allocation found for this ICAO');
    return { found: false };
  }
}
