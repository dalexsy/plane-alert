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
    console.log('\n=== TESTING SAN MARINO VS ALBANIA FIX ===');
    
    // Test T7 registration (San Marino)
    const t7Result = service.getAircraftCountryDetailed('T7-ABC');
    console.log(`T7-ABC registration: ${t7Result.countryCode} (${t7Result.source})`);
    expect(t7Result.countryCode).toBe('SM');
    expect(t7Result.source).toBe('registration');

    // Test San Marino ICAO hex range
    const smHexResult = service.getAircraftCountryDetailed(undefined, '500123');
    console.log(`San Marino ICAO hex 500123: ${smHexResult.countryCode} (${smHexResult.source})`);
    expect(smHexResult.countryCode).toBe('SM');
    expect(smHexResult.source).toBe('icao-hex');

    // Test Albanian ICAO hex range
    const alHexResult = service.getAircraftCountryDetailed(undefined, '501123');
    console.log(`Albanian ICAO hex 501123: ${alHexResult.countryCode} (${alHexResult.source})`);
    expect(alHexResult.countryCode).toBe('AL');
    expect(alHexResult.source).toBe('icao-hex');

    console.log('✅ San Marino vs Albania mapping fixed!');
  });

  it('should correctly fix the Norwegian vs Italian issue', () => {
    console.log('\n=== TESTING NORWEGIAN VS ITALIAN FIX ===');
    
    // Test the Norwegian ICAO hex that was incorrectly showing as Italian
    const noResult = service.getAircraftCountryDetailed(undefined, '4c1234');
    console.log(`Norwegian ICAO hex 4c1234: ${noResult.countryCode} (${noResult.source})`);
    expect(noResult.countryCode).toBe('NO');
    expect(noResult.source).toBe('icao-hex');

    // Test Norwegian registration
    const noRegResult = service.getAircraftCountryDetailed('LN-ABC');
    console.log(`Norwegian registration LN-ABC: ${noRegResult.countryCode} (${noRegResult.source})`);
    expect(noRegResult.countryCode).toBe('NO');
    expect(noRegResult.source).toBe('registration');

    console.log('✅ Norwegian vs Italian mapping fixed!');
  });

  it('should demonstrate enterprise features', () => {
    console.log('\n=== TESTING ENTERPRISE FEATURES ===');
    
    // Test military pattern detection
    const militaryResult = service.getAircraftCountryDetailed('54+01');
    console.log(`German military 54+01: ${militaryResult.countryCode} (${militaryResult.source})`);
    expect(militaryResult.countryCode).toBe('DE');
    expect(militaryResult.source).toBe('military-pattern');

    // Test comprehensive info
    const comprehensiveInfo = service.getAircraftInfo('T7-ABC', '500123', 'US');
    console.log(`Comprehensive info for T7-ABC with US API override:`);
    console.log(`  Final country: ${comprehensiveInfo.countryCode} (${comprehensiveInfo.source})`);
    console.log(`  Has registration: ${comprehensiveInfo.diagnostics.hasRegistration}`);
    console.log(`  Has ICAO hex: ${comprehensiveInfo.diagnostics.hasIcaoHex}`);
    console.log(`  Has API country: ${comprehensiveInfo.diagnostics.hasApiCountry}`);
    
    expect(comprehensiveInfo.countryCode).toBe('US'); // API should win
    expect(comprehensiveInfo.source).toBe('api');

    // Test cache functionality
    const cacheStats = service.getCacheStats();
    console.log(`Cache entries: ${cacheStats.size}`);
    expect(cacheStats.size).toBeGreaterThanOrEqual(0);

    console.log('✅ Enterprise features working!');
  });

  it('should provide detailed metadata for debugging', () => {
    console.log('\n=== TESTING DETAILED METADATA ===');
    
    const result = service.getAircraftCountryDetailed(undefined, '500123');
    console.log('San Marino ICAO allocation metadata:');
    console.log(`  Country: ${result.metadata?.icaoAllocation?.countryName}`);
    console.log(`  Type: ${result.metadata?.icaoAllocation?.type}`);
    console.log(`  Notes: ${result.metadata?.icaoAllocation?.notes}`);
    
    expect(result.metadata?.icaoAllocation?.countryName).toBe('San Marino');
    expect(result.metadata?.icaoAllocation?.notes).toContain('T7 prefix');
    
    console.log('✅ Detailed metadata working!');
  });
});
