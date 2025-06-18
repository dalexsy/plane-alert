/**
 * ICAO Lookup Configuration
 *
 * Configuration settings for ICAO hex code lookups and caching behavior.
 * The actual ICAO country ranges are stored in: src/assets/data/icao-country-ranges.json
 */

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
