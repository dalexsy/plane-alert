import { Injectable } from '@angular/core';
import registrationCountryPrefix from '../../assets/data/registration-country-prefix.json';
import {
  IcaoAllocationUtils,
  ICAO_LOOKUP_CONFIG,
  MILITARY_REGISTRATION_PATTERNS,
  type MilitaryRegistrationPattern,
} from '../config/icao-allocations.config';

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
  };
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
    // First priority: Use API-provided country if valid
    if (apiCountry && /^[A-Za-z]{2}$/.test(apiCountry)) {
      return {
        countryCode: apiCountry.toUpperCase(),
        confidence: 'high',
        source: 'api',
      };
    }

    // Second priority: Military registration patterns (specialized handling)
    if (registration) {
      const militaryResult =
        this.checkMilitaryRegistrationPattern(registration);
      if (militaryResult) {
        return militaryResult;
      }
    }

    // Third priority: Standard registration prefix lookup (most reliable for civilian)
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
    return this.getAircraftCountryDetailed(registration, icaoHex, apiCountry)
      .countryCode;
  }

  /**
   * Checks for military registration patterns that follow special rules
   */
  private checkMilitaryRegistrationPattern(
    registration: string
  ): CountryDetectionResult | null {
    const reg = registration.trim().toUpperCase();

    for (const pattern of MILITARY_REGISTRATION_PATTERNS) {
      const regex = new RegExp(pattern.pattern);
      if (regex.test(reg)) {
        return {
          countryCode: pattern.countryCode,
          confidence: 'high',
          source: 'military-pattern',
          metadata: {
            militaryPattern: pattern.description,
          },
        };
      }
    }

    return null;
  }

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
    }

    return {
      countryCode: 'Unknown',
      confidence: 'low',
      source: 'unknown',
    };
  }

  /**
   * Gets country from ICAO 24-bit address using enterprise configuration
   */
  private getCountryFromIcaoHexDetailed(
    icaoHex: string
  ): CountryDetectionResult {
    // Check cache first
    const cacheKey = `icao:${icaoHex.toLowerCase()}`;
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

    // Use the enterprise configuration utility
    const allocationInfo = IcaoAllocationUtils.getAllocationInfo(icaoHex);

    if (allocationInfo) {
      // Cache the result
      this.lookupCache.set(cacheKey, {
        result: allocationInfo.countryCode,
        timestamp: Date.now(),
      });

      return {
        countryCode: allocationInfo.countryCode,
        confidence: 'medium',
        source: 'icao-hex',
        metadata: {
          icaoAllocation: {
            range: `${allocationInfo.start
              .toString(16)
              .toUpperCase()}-${allocationInfo.end.toString(16).toUpperCase()}`,
            countryName: allocationInfo.countryName,
            type: allocationInfo.type,
            notes: allocationInfo.notes,
          },
        },
      };
    }

    // Log unknown hex codes if configured
    if (ICAO_LOOKUP_CONFIG.logUnknownHexCodes) {
      console.info(
        `Unknown ICAO hex code: ${icaoHex} (decimal: ${parseInt(icaoHex, 16)})`
      );
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
        icaoAllocations:
          result.countryCode !== 'Unknown'
            ? IcaoAllocationUtils.getAllocationsForCountry(result.countryCode)
            : [],
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
}
