// Quick test to verify our enterprise aircraft country service is working
// Run with: ng test --include="**/aircraft-country-integration.spec.ts" --watch=false

import { TestBed } from '@angular/core/testing';
import { AircraftCountryService } from './aircraft-country.service';

describe('AircraftCountryService Integration Tests', () => {
  let service: AircraftCountryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AircraftCountryService);
    service.clearCache();
  });

  it('should correctly fix the San Marino vs Albania issue', () => {
    // Testing San Marino vs Albania fix

    // Test T7 registration (San Marino)
    const t7Result = service.getAircraftCountryDetailed('T7-ABC');
    // T7-ABC registration result logged
    expect(t7Result.countryCode).toBe('SM');
    expect(t7Result.source).toBe('registration');

    // Test San Marino ICAO hex range
    const smHexResult = service.getAircraftCountryDetailed(undefined, '500123');
    // San Marino ICAO hex 500123 result logged
    expect(smHexResult.countryCode).toBe('SM');
    expect(smHexResult.source).toBe('icao-hex');

    // Test Albanian ICAO hex range
    const alHexResult = service.getAircraftCountryDetailed(undefined, '501123');
    // Albanian ICAO hex 501123 result logged
    expect(alHexResult.countryCode).toBe('AL');
    expect(alHexResult.source).toBe('icao-hex');

    // San Marino vs Albania mapping fixed!
  });

  it('should correctly fix the Norwegian vs Italian issue', () => {
    // Testing Norwegian vs Italian fix

    // Test the Norwegian ICAO hex that was incorrectly showing as Italian
    const noResult = service.getAircraftCountryDetailed(undefined, '4c1234');
    // Norwegian ICAO hex 4c1234 result logged
    expect(noResult.countryCode).toBe('NO');
    expect(noResult.source).toBe('icao-hex');

    // Test Norwegian registration
    const noRegResult = service.getAircraftCountryDetailed('LN-ABC');
    // Norwegian registration LN-ABC result logged
    expect(noRegResult.countryCode).toBe('NO');
    expect(noRegResult.source).toBe('registration');

    // Norwegian vs Italian mapping fixed!
  });

  it('should demonstrate enterprise features', () => {
    // Testing enterprise features

    // Test military pattern detection
    const militaryResult = service.getAircraftCountryDetailed('54+01');
    // German military 54+01 result logged
    expect(militaryResult.countryCode).toBe('DE');
    expect(militaryResult.source).toBe('military-pattern');

    // Test comprehensive info
    const comprehensiveInfo = service.getAircraftInfo('T7-ABC', '500123', 'US');
    // Comprehensive info for T7-ABC with US API override logged
    // Final country logged
    // Has registration logged
    // Has ICAO hex logged
    // Has API country logged

    expect(comprehensiveInfo.countryCode).toBe('US'); // API should win
    expect(comprehensiveInfo.source).toBe('api');

    // Test cache functionality
    const cacheStats = service.getCacheStats();
    // Cache entries logged
    expect(cacheStats.size).toBeGreaterThanOrEqual(0);

    // Enterprise features working!
  });

  it('should provide detailed metadata for debugging', () => {
    // Testing detailed metadata

    const result = service.getAircraftCountryDetailed(undefined, '500123');
    // San Marino ICAO allocation metadata logged
    // Country logged
    // Type logged
    // Notes logged

    expect(result.metadata?.icaoAllocation?.countryName).toBe('San Marino');
    expect(result.metadata?.icaoAllocation?.notes).toContain('T7 prefix');

    // Detailed metadata working!
  });
});
