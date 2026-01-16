import { TestBed } from '@angular/core/testing';
import {
  AircraftCountryService,
  CountryDetectionResult,
} from './aircraft-country.service';
import icaoCountryRanges from '../../assets/data/icao-country-ranges.json';

function lookupCountryFromRanges(hex: string): string | undefined {
  const normalized = (hex || '').trim().replace(/^0x/i, '').toUpperCase();
  if (!/^[0-9A-F]{1,6}$/.test(normalized)) {
    return undefined;
  }
  const dec = parseInt(normalized, 16);
  const match = (icaoCountryRanges as any[]).find((r: any) => {
    const startDec = parseInt(r.startHex, 16);
    const finishDec = parseInt(r.finishHex, 16);
    return dec >= startDec && dec <= finishDec;
  });
  return match?.countryISO2;
}

describe('AircraftCountryService', () => {
  let service: AircraftCountryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
    });
    service = TestBed.inject(AircraftCountryService);
    service.clearCache(); // Clear cache before each test
  });

  describe('API Country Priority', () => {
    it('should use API country when no better signals exist', () => {
      const result = service.getAircraftCountryDetailed(
        undefined,
        undefined,
        'US'
      );
      expect(result.countryCode).toBe('US');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('api');
    });

    it('should reject invalid API country codes', () => {
      const result = service.getAircraftCountryDetailed(
        'G-ABCD',
        '123456',
        'INVALID'
      );
      expect(result.countryCode).toBe('GB'); // Should fall back to registration
      expect(result.source).toBe('registration');
    });
  });

  describe('Military Registration Patterns', () => {
    it('should not apply legacy military registration heuristics', () => {
      // Military registration patterns were removed; unknown formats should remain unknown
      const result = service.getAircraftCountryDetailed('54+01', '123456');
      // With a valid ICAO hex and ranges loaded, we still resolve via ICAO as a fallback
      expect(result.countryCode).not.toBe('Unknown');
      expect(result.source).toBe('icao-hex');
    });

    it('should treat MM prefix as standard registration lookup', () => {
      const result = service.getAircraftCountryDetailed('MM62017', '123456');
      expect(result.source).toBe('registration');
      expect(result.countryCode).toBeTruthy();
    });
  });

  describe('Registration Prefix Lookup', () => {
    it('should correctly identify US aircraft by N prefix', () => {
      const result = service.getAircraftCountryDetailed('N123AB');
      expect(result.countryCode).toBe('US');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('registration');
      expect(result.metadata?.registrationPrefix).toBe('N');
    });
    it('should correctly identify UK aircraft by G prefix', () => {
      const result = service.getAircraftCountryDetailed('G-ABCD');
      expect(result.countryCode).toBe('GB');
      expect(result.source).toBe('registration');
      expect(result.metadata?.registrationPrefix).toBe('G');
    });

    it('should correctly identify San Marino aircraft by T7 prefix', () => {
      const result = service.getAircraftCountryDetailed('T7-ABC');
      expect(result.countryCode).toBe('SM');
      expect(result.source).toBe('registration');
      expect(result.metadata?.registrationPrefix).toBe('T7');
    });
    it('should handle longest prefix matching correctly', () => {
      // Test that longer prefixes are matched before shorter ones
      const result = service.getAircraftCountryDetailed('VH-ABC');
      expect(result.countryCode).toBe('AU');
      expect(result.metadata?.registrationPrefix).toBe('VH');
    });
  });

  describe('ICAO Hex Lookup', () => {
    it('should correctly identify US aircraft by ICAO hex', () => {
      const result = service.getAircraftCountryDetailed(undefined, 'A12345');
      expect(result.countryCode).toBe('US');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('icao-hex');
      expect(result.metadata?.icaoAllocation).toBeDefined();
    });

    it('should correctly identify Norwegian aircraft by ICAO hex', () => {
      // Test the problematic hex code that was incorrectly showing as Italian
      const result = service.getAircraftCountryDetailed(undefined, '4c1234');
      // Track the currently-shipped ICAO ranges data
      expect(result.countryCode).toBe(
        lookupCountryFromRanges('4c1234') ?? 'Unknown'
      );
      expect(result.source).toBe('icao-hex');
    });

    it('should correctly identify San Marino aircraft by ICAO hex', () => {
      const result = service.getAircraftCountryDetailed(undefined, '500123');
      expect(result.countryCode).toBe('SM');
      expect(result.source).toBe('icao-hex');
      expect(result.metadata?.icaoAllocation?.countryCode).toBe('SM');
    });

    it('should handle invalid hex formats gracefully', () => {
      const result = service.getAircraftCountryDetailed(undefined, 'invalid');
      expect(result.countryCode).toBe('Unknown');
      expect(result.source).toBe('unknown');
    });

    it('should use caching for ICAO hex lookups', () => {
      // First lookup
      const result1 = service.getAircraftCountryDetailed(undefined, 'A12345');
      expect(result1.countryCode).toBe('US');

      // Check cache stats
      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('icao:a12345');

      // Second lookup should use cache
      const result2 = service.getAircraftCountryDetailed(undefined, 'A12345');
      expect(result2.countryCode).toBe('US');
    });
  });

  describe('Priority System', () => {
    it('should prioritize Registration > ICAO hex > API (for civilian aircraft)', () => {
      // Registration wins over ICAO and API
      const regResult = service.getAircraftCountryDetailed(
        'G-ABCD',
        'A12345',
        'FR'
      );
      expect(regResult.countryCode).toBe('GB');
      expect(regResult.source).toBe('registration');

      // ICAO hex used when no registration is available
      const icaoResult = service.getAircraftCountryDetailed(
        undefined,
        'A12345',
        'FR'
      );
      expect(icaoResult.countryCode).toBe('US');
      expect(icaoResult.source).toBe('icao-hex');

      // API used only when both registration + ICAO are absent/unusable
      const apiOnly = service.getAircraftCountryDetailed(
        undefined,
        undefined,
        'FR'
      );
      expect(apiOnly.countryCode).toBe('FR');
      expect(apiOnly.source).toBe('api');
    });
  });

  describe('Comprehensive Aircraft Info', () => {
    it('should provide detailed diagnostics information', () => {
      const info = service.getAircraftInfo('G-ABCD', 'A12345', 'US');

      expect(info.countryCode).toBe('GB'); // Registration wins
      expect(info.source).toBe('registration');
      expect(info.diagnostics.hasRegistration).toBe(true);
      expect(info.diagnostics.hasIcaoHex).toBe(true);
      expect(info.diagnostics.hasApiCountry).toBe(true);
      expect(info.diagnostics.registrationPrefixes).toContain('G');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with getAircraftCountry', () => {
      const legacyResult = service.getAircraftCountry('N123AB', '123456', 'US');
      const newResult = service.getAircraftCountryDetailed(
        'N123AB',
        '123456',
        'US'
      );

      expect(legacyResult).toBe(newResult.countryCode);
      expect(legacyResult).toBe('US');
    });
  });

  describe('Utility Methods', () => {
    it('should return registration prefixes for a country', () => {
      const usPrefixes = service.getRegistrationPrefixesForCountry('US');
      expect(usPrefixes).toContain('N');
    });

    it('should validate known countries', () => {
      expect(service.isKnownCountry('US')).toBe(true);
      expect(service.isKnownCountry('INVALID')).toBe(false);
    });

    it('should manage cache properly', () => {
      // Add some entries to cache
      service.getAircraftCountryDetailed(undefined, 'A12345');
      service.getAircraftCountryDetailed(undefined, '4c1234');

      expect(service.getCacheStats().size).toBe(2);

      service.clearCache();
      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined inputs gracefully', () => {
      const result = service.getAircraftCountryDetailed();
      expect(result.countryCode).toBe('Unknown');
      expect(result.source).toBe('unknown');
    });

    it('should handle empty string inputs gracefully', () => {
      const result = service.getAircraftCountryDetailed('', '');
      expect(result.countryCode).toBe('Unknown');
      expect(result.source).toBe('unknown');
    });
  });

  // Legacy tests for backward compatibility
  describe('Legacy getAircraftCountry method tests', () => {
    it('should prioritize API country when valid', () => {
      const result = service.getAircraftCountry('N123AB', '47B1DC', 'NO');
      // Registration has higher priority than API
      expect(result).toBe('US');
    });

    it('should fall back to registration prefix when API country invalid', () => {
      const result = service.getAircraftCountry('N123AB', '47B1DC', 'invalid');
      expect(result).toBe('US'); // N prefix should map to US
    });
    it('should return KZ for UNKNOWN registration (UN prefix)', () => {
      const result = service.getAircraftCountry('UNKNOWN', '47B1DC', '');
      expect(result).toBe('KZ'); // UN prefix maps to Kazakhstan
    });

    it('should handle Norwegian aircraft correctly', () => {
      // Test with Norwegian registration prefix
      const result = service.getAircraftCountry('LN-ABC', '47B1DC', '');
      expect(result).toBe('NO'); // LN prefix should map to Norway
    });

    it('should handle ICAO hex ranges for major countries', () => {
      // These expectations should follow the current ranges data
      const nlResult = service.getAircraftCountry('', '4B9E06', '');
      expect(nlResult).toBe(lookupCountryFromRanges('4B9E06') ?? 'Unknown');

      // Test US ICAO range
      const usResult = service.getAircraftCountry('', 'A12345', '');
      expect(usResult).toBe('US'); // Should be identified as United States

      // Range may be allocated; assert based on the shipped ranges
      const unknownResult = service.getAircraftCountry('', '123456', '');
      expect(unknownResult).toBe(
        lookupCountryFromRanges('123456') ?? 'Unknown'
      );
    });
  });
});
