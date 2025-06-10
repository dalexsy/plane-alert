/**
 * ICAO 24-bit Address Allocation Configuration
 *
 * This configuration defines the official ICAO hex address ranges allocated to different countries.
 * These allocations are based on ICAO documentation and are maintained separately for easier updates.
 *
 * Source: ICAO Annex 10, Volume III, Chapter 9
 * Last updated: May 2025
 */

export interface IcaoAllocation {
  /** Starting hex address (inclusive) */
  start: number;
  /** Ending hex address (inclusive) */
  end: number;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Human-readable country name */
  countryName: string;
  /** Allocation type: civil, military, or mixed */
  type: 'civil' | 'military' | 'mixed';
  /** Additional notes about this allocation */
  notes?: string;
}

/**
 * Well-documented and stable ICAO allocations
 * Only includes major allocations that are unlikely to change
 */
export const ICAO_ALLOCATIONS: IcaoAllocation[] = [
  // North America
  {
    start: 0xa00000,
    end: 0xafffff,
    countryCode: 'US',
    countryName: 'United States',
    type: 'mixed',
    notes: 'Primary US allocation block',
  },
  {
    start: 0xc00000,
    end: 0xc3ffff,
    countryCode: 'CA',
    countryName: 'Canada',
    type: 'civil',
    notes: 'Canadian civil aviation',
  },

  // Europe - Germany
  {
    start: 0x380000,
    end: 0x3bffff,
    countryCode: 'DE',
    countryName: 'Germany',
    type: 'civil',
    notes: 'German civil aviation',
  },
  {
    start: 0x3c0000,
    end: 0x3fffff,
    countryCode: 'DE',
    countryName: 'Germany',
    type: 'military',
    notes: 'German military aviation',
  },

  // Europe - Other Major Countries
  {
    start: 0x400000,
    end: 0x43ffff,
    countryCode: 'GB',
    countryName: 'United Kingdom',
    type: 'mixed',
    notes: 'UK civil and military aviation',
  },
  {
    start: 0x0a0000,
    end: 0x0a7fff,
    countryCode: 'FR',
    countryName: 'France',
    type: 'civil',
    notes: 'French civil aviation',
  },
  {
    start: 0x440000,
    end: 0x45ffff,
    countryCode: 'IT',
    countryName: 'Italy',
    type: 'mixed',
    notes: 'Italian aviation (part 1)',
  },
  {
    start: 0x460000,
    end: 0x46ffff,
    countryCode: 'FI',
    countryName: 'Finland',
    type: 'civil',
    notes: 'Finnish aviation',
  },
  {
    start: 0x470000,
    end: 0x47ffff,
    countryCode: 'IT',
    countryName: 'Italy',
    type: 'mixed',
    notes: 'Italian aviation (part 2)',
  },
  {
    start: 0x480000,
    end: 0x4bffff,
    countryCode: 'NL',
    countryName: 'Netherlands',
    type: 'mixed',
    notes: 'Dutch aviation',
  },
  {
    start: 0x4c0000,
    end: 0x4dffff,
    countryCode: 'SE',
    countryName: 'Sweden',
    type: 'mixed',
    notes: 'Swedish aviation including military aircraft',
  },
  {
    start: 0x4e0000,
    end: 0x4fffff,
    countryCode: 'NO',
    countryName: 'Norway',
    type: 'mixed',
    notes: 'Norwegian aviation',
  },
  {
    start: 0x340000,
    end: 0x37ffff,
    countryCode: 'ES',
    countryName: 'Spain',
    type: 'mixed',
    notes: 'Spanish aviation',
  },
  // Europe - Small States (previously problematic)
  {
    start: 0x500000,
    end: 0x5003ff,
    countryCode: 'SM',
    countryName: 'San Marino',
    type: 'civil',
    notes: 'T7 prefix aircraft - previously incorrectly mapped to Albania',
  },
  {
    start: 0x501000,
    end: 0x5013ff,
    countryCode: 'AL',
    countryName: 'Albania',
    type: 'civil',
    notes: 'Albanian civil aviation',
  },
  {
    start: 0x501400,
    end: 0x501fff,
    countryCode: 'HR',
    countryName: 'Croatia',
    type: 'civil',
    notes: 'Croatian civil aviation',
  },
  {
    start: 0x503e00,
    end: 0x503eff,
    countryCode: 'LT',
    countryName: 'Lithuania',
    type: 'civil',
    notes: 'Lithuanian civil aviation',
  },
  // Asia-Pacific
  {
    start: 0x800000,
    end: 0x83ffff,
    countryCode: 'IN',
    countryName: 'India',
    type: 'mixed',
    notes: 'Indian aviation',
  },
  {
    start: 0x840000,
    end: 0x87ffff,
    countryCode: 'JP',
    countryName: 'Japan',
    type: 'mixed',
    notes: 'Japanese aviation',
  },
  {
    start: 0x780000,
    end: 0x7bffff,
    countryCode: 'CN',
    countryName: 'China',
    type: 'mixed',
    notes: 'Chinese aviation',
  },
  {
    start: 0x7c0000,
    end: 0x7fffff,
    countryCode: 'AU',
    countryName: 'Australia',
    type: 'mixed',
    notes: 'Australian aviation',
  },
];

/**
 * Configuration for ICAO allocation lookup behavior
 */
export const ICAO_LOOKUP_CONFIG = {
  /** Whether to enable ICAO hex lookup as a fallback */
  enableIcaoLookup: true,

  /** Whether to log unknown ICAO hex codes for debugging */
  logUnknownHexCodes: true,

  /** Maximum age in milliseconds for cached lookups */
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours

  /** Whether to perform case-insensitive hex lookups */
  caseInsensitive: true,
} as const;

/**
 * Military registration patterns that follow special rules
 */
export interface MilitaryRegistrationPattern {
  /** Pattern to match (regex string) */
  pattern: string;
  /** Country code for this pattern */
  countryCode: string;
  /** Description of the pattern */
  description: string;
}

export const MILITARY_REGISTRATION_PATTERNS: MilitaryRegistrationPattern[] = [
  {
    pattern: '^54\\+',
    countryCode: 'DE',
    description: 'German military aircraft (54+ prefix)',
  },
  {
    pattern: '^ZK-',
    countryCode: 'NZ',
    description: 'New Zealand military aircraft',
  },
  {
    pattern: '^MM\\d+',
    countryCode: 'IT',
    description: 'Italian military aircraft',
  },
];

/**
 * Utility functions for ICAO allocation lookups
 */
export class IcaoAllocationUtils {
  /**
   * Validates if a string is a valid hexadecimal format
   */
  private static isValidHex(hex: string): boolean {
    return /^[0-9A-Fa-f]+$/.test(hex);
  }

  /**
   * Finds the country allocation for a given ICAO hex code
   */ static findCountryByIcaoHex(icaoHex: string): string | null {
    // Validate hex format first
    if (!icaoHex || !this.isValidHex(icaoHex)) {
      if (ICAO_LOOKUP_CONFIG.logUnknownHexCodes) {
        // Invalid ICAO hex format logged
      }
      return null;
    }

    try {
      const icaoDec = parseInt(icaoHex, 16);

      for (const allocation of ICAO_ALLOCATIONS) {
        if (icaoDec >= allocation.start && icaoDec <= allocation.end) {
          return allocation.countryCode;
        }
      }
    } catch (error) {
      if (ICAO_LOOKUP_CONFIG.logUnknownHexCodes) {
        // Error parsing ICAO hex logged
      }
    }

    return null;
  }

  /**
   * Gets all allocations for a specific country
   */
  static getAllocationsForCountry(countryCode: string): IcaoAllocation[] {
    return ICAO_ALLOCATIONS.filter(
      (allocation) => allocation.countryCode === countryCode.toUpperCase()
    );
  }

  /**
   * Checks if a given ICAO hex falls within any known allocation
   */
  static isKnownIcaoHex(icaoHex: string): boolean {
    return IcaoAllocationUtils.findCountryByIcaoHex(icaoHex) !== null;
  }
  /**
   * Gets allocation info including metadata for a given ICAO hex
   */
  static getAllocationInfo(icaoHex: string): IcaoAllocation | null {
    // Validate hex format first
    if (!icaoHex || !this.isValidHex(icaoHex)) {
      if (ICAO_LOOKUP_CONFIG.logUnknownHexCodes) {
        // Invalid ICAO hex format would be logged here
      }
      return null;
    }

    try {
      const icaoDec = parseInt(icaoHex, 16);

      for (const allocation of ICAO_ALLOCATIONS) {
        if (icaoDec >= allocation.start && icaoDec <= allocation.end) {
          return allocation;
        }
      }
    } catch (error) {
      if (ICAO_LOOKUP_CONFIG.logUnknownHexCodes) {
        // Error parsing ICAO hex would be logged here
      }
    }

    return null;
  }
}
