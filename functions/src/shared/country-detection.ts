/**
 * Country detection logic for aircraft based on ICAO hex codes and registration prefixes
 */

import type { CountryDetectionResult, IcaoCountryRange } from './types';
import icaoCountryRanges from '../shared-data/icao-country-ranges.json';
import registrationCountryPrefix from '../shared-data/registration-country-prefix.json';

// Precompute decimal values for ICAO ranges
const ICAO_RANGES: IcaoCountryRange[] = (icaoCountryRanges as any[]).map(
  (r) => ({
    ...r,
    startDec: parseInt(r.startHex, 16),
    finishDec: parseInt(r.finishHex, 16),
  })
);

const REGISTRATION_PREFIXES: Record<string, string> =
  registrationCountryPrefix as any;

/**
 * ICAO lookup configuration
 */
export const ICAO_LOOKUP_CONFIG = {
  enableIcaoLookup: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  caseInsensitive: true,
} as const;

/**
 * Gets country from ICAO 24-bit address using comprehensive range data
 */
export function getCountryFromIcaoHex(icaoHex: string): CountryDetectionResult {
  // Clean up ICAO hex - remove common prefixes like ~
  let cleanIcaoHex = icaoHex;
  if (icaoHex && icaoHex.startsWith('~')) {
    cleanIcaoHex = icaoHex.substring(1);
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
    const icaoDec = parseInt(cleanIcaoHex, 16);

    // Search through ICAO ranges
    for (const range of ICAO_RANGES) {
      if (icaoDec >= range.startDec! && icaoDec <= range.finishDec!) {
        return {
          countryCode: range.countryISO2,
          confidence: 'high',
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
 * Gets country from aircraft registration prefix
 */
export function getCountryFromRegistration(
  registration: string
): CountryDetectionResult {
  const reg = registration.trim().toUpperCase();

  // Sort prefixes by length (longest first) to match most specific prefix
  const sortedPrefixes = Object.keys(REGISTRATION_PREFIXES).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return {
        countryCode: REGISTRATION_PREFIXES[prefix],
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
 * Determines the country of origin for an aircraft with priority system
 *
 * Priority (highest to lowest):
 * 1. For military aircraft: ICAO hex (more reliable for military)
 * 2. Registration prefix lookup
 * 3. For civilian aircraft: ICAO hex lookup
 * 4. API-provided country
 */
export function getAircraftCountry(
  registration?: string,
  icaoHex?: string,
  apiCountry?: string,
  isMilitary?: boolean
): CountryDetectionResult {
  // For MILITARY aircraft: ICAO hex is more reliable than registration
  // Military aircraft often use non-standard registrations
  if (isMilitary && icaoHex && ICAO_LOOKUP_CONFIG.enableIcaoLookup) {
    const icaoResult = getCountryFromIcaoHex(icaoHex);
    if (icaoResult.countryCode !== 'Unknown') {
      return icaoResult;
    }
  }

  // Second priority: Standard registration prefix lookup (most reliable for civilian)
  if (registration) {
    const regResult = getCountryFromRegistration(registration);
    if (regResult.countryCode !== 'Unknown') {
      return regResult;
    }
  }

  // Third priority: ICAO hex lookup for civilian aircraft
  if (icaoHex && ICAO_LOOKUP_CONFIG.enableIcaoLookup && !isMilitary) {
    const icaoResult = getCountryFromIcaoHex(icaoHex);
    if (icaoResult.countryCode !== 'Unknown') {
      return icaoResult;
    }
  }

  // Fourth priority: Use API-provided country if valid
  if (apiCountry && /^[A-Za-z]{2}$/.test(apiCountry)) {
    return {
      countryCode: apiCountry.toUpperCase(),
      confidence: 'high',
      source: 'api',
    };
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
export function getRegistrationPrefixesForCountry(
  countryCode: string
): string[] {
  return Object.entries(REGISTRATION_PREFIXES)
    .filter(([, country]) => country === countryCode)
    .map(([prefix]) => prefix);
}

/**
 * Validates if a country code is known in our registration database
 */
export function isKnownCountry(countryCode: string): boolean {
  return Object.values(REGISTRATION_PREFIXES).includes(countryCode);
}
