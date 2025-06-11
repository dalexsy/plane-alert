# Aircraft Country Service - Enterprise Refactoring

## Overview

The `AircraftCountryService` has been completely refactored from a simple data lookup service to an enterprise-ready, maintainable, and highly configurable country detection system for aircraft identification.

## Key Improvements

### 1. **Architectural Enhancements**

- **Configuration-driven**: Moved hardcoded ICAO allocations to `icao-allocations.config.ts`
- **Priority-based detection**: API > Military Patterns > Registration > ICAO Hex
- **Caching system**: Intelligent caching with configurable TTL
- **Detailed results**: Rich metadata and confidence levels
- **Enterprise utilities**: Reusable utility classes and helper functions

### 2. **Fixed Core Issues**

- ✅ **San Marino vs Albania**: Fixed incorrect ICAO hex range 500000-519FFF mapping
- ✅ **Norwegian vs Italian**: Fixed 4c0000-4fffff range correctly mapped to Norway
- ✅ **Registration priorities**: Proper longest-prefix matching for registration prefixes
- ✅ **Military patterns**: Added support for special military registration patterns (54+, MM, etc.)

### 3. **New Features**

#### **Detailed Country Detection**

```typescript
interface CountryDetectionResult {
  countryCode: string;
  confidence: "high" | "medium" | "low";
  source: "api" | "registration" | "military-pattern" | "icao-hex" | "unknown";
  metadata?: {
    registrationPrefix?: string;
    icaoAllocation?: any;
    militaryPattern?: string;
  };
}
```

#### **Military Registration Support**

- German military: `54+XX` patterns → DE
- Italian military: `MMXXXX` patterns → IT
- New Zealand military: `ZK-` patterns → NZ

#### **Enterprise Configuration**

```typescript
// icao-allocations.config.ts
export const ICAO_ALLOCATIONS: IcaoAllocation[] = [
  {
    start: 0x500000,
    end: 0x5003ff,
    countryCode: "SM",
    countryName: "San Marino",
    type: "civil",
    notes: "T7 prefix aircraft - previously incorrectly mapped to Albania",
  },
  // ... more allocations
];
```

#### **Caching and Performance**

- Intelligent caching for ICAO hex lookups
- Configurable cache TTL (24 hours default)
- Cache statistics and management
- Performance optimized prefix matching

### 4. **API Improvements**

#### **New Methods**

- `getAircraftCountryDetailed()` - Returns rich result with metadata
- `getAircraftInfo()` - Comprehensive diagnostics information
- `clearCache()` - Cache management
- `getCacheStats()` - Cache monitoring

#### **Backward Compatibility**

- `getAircraftCountry()` - Legacy method still works (marked deprecated)
- All existing code continues to work without changes

### 5. **Quality Assurance**

#### **Comprehensive Testing**

- 26 unit tests covering all functionality
- Enterprise feature testing (caching, military patterns, etc.)
- Legacy compatibility testing
- Error handling and edge cases
- All tests passing ✅

#### **Production Ready**

- Error handling for invalid inputs
- Graceful fallbacks for unknown aircraft
- Logging for debugging unknown patterns
- Configuration-driven behavior

## Configuration Files

### **ICAO Allocations** (`icao-allocations.config.ts`)

- Well-documented ICAO hex range allocations
- Configurable lookup behavior
- Utility classes for allocation management
- Military registration pattern definitions

### **Registration Prefixes** (`registration-country-prefix.json`)

- Existing registration prefix data (unchanged)
- Proper longest-prefix matching algorithm
- Support for complex prefixes like "G-", "VH-", etc.

## Usage Examples

### **Basic Usage (Legacy)**

```typescript
const country = aircraftCountryService.getAircraftCountry("T7-ABC", "500123", "SM");
// Returns: 'SM' (San Marino)
```

### **Enterprise Usage (New)**

```typescript
const result = aircraftCountryService.getAircraftCountryDetailed("T7-ABC", "500123");
// Returns: {
//   countryCode: 'SM',
//   confidence: 'high',
//   source: 'registration',
//   metadata: { registrationPrefix: 'T7' }
// }
```

### **Military Aircraft**

```typescript
const military = aircraftCountryService.getAircraftCountryDetailed("54+01");
// Returns: {
//   countryCode: 'DE',
//   confidence: 'high',
//   source: 'military-pattern',
//   metadata: { militaryPattern: 'German military aircraft (54+ prefix)' }
// }
```

### **Comprehensive Diagnostics**

```typescript
const info = aircraftCountryService.getAircraftInfo("T7-ABC", "500123", "US");
// Returns detailed diagnostics including all available data sources
```

## Performance Improvements

- **Caching**: ICAO hex lookups are cached for 24 hours
- **Optimized matching**: Longest-prefix-first registration matching
- **Lazy loading**: Configuration loaded only when needed
- **Memory efficient**: Cache management and cleanup

## Monitoring and Debugging

- **Unknown aircraft logging**: Configurable logging for unknown patterns
- **Cache statistics**: Monitor cache hit rates and performance
- **Detailed metadata**: Rich debugging information for each lookup
- **Source tracking**: Know exactly why each country was assigned

## Future Enhancements

- Additional ICAO allocation ranges can be easily added to configuration
- API integration for real-time allocation updates
- Machine learning for unknown aircraft pattern detection
- Integration with external aviation databases

## Migration Notes

- **No breaking changes**: All existing code continues to work
- **Gradual migration**: Can start using new detailed methods gradually
- **Enhanced debugging**: Better visibility into country assignment logic
- **Future-proof**: Configuration-driven approach allows easy updates

This refactoring transforms the aircraft country service from a simple lookup table into a robust, enterprise-ready system that properly handles the complex world of aircraft identification while maintaining backward compatibility.
