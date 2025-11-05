# @plane-alert/shared

Shared aircraft detection and classification logic for the Plane Alert project.

## Overview

This package contains pure TypeScript functions for:

- **Country Detection**: Determining aircraft origin from ICAO hex codes and registration prefixes
- **Military Detection**: Identifying military aircraft while filtering out boring types (trainers, business jets)
- **Geographic Utilities**: Distance and bearing calculations

## Why This Exists

The Plane Alert project has two separate codebases that need identical aircraft detection logic:

1. **Angular Frontend** (runs in browser) - displays aircraft with flags and classifications
2. **Cloud Functions Backend** (runs on Google Cloud) - sends push notifications for military aircraft

Rather than duplicating code, this shared library provides a single source of truth for all aircraft detection logic.

## Installation

From the monorepo root:

```bash
cd shared
npm install
npm run build
```

## Usage

### In Cloud Functions (Node.js)

```typescript
import { looksMilitary, getAircraftCountry } from "@plane-alert/shared";

const plane = {
  hex: "3f717c",
  flight: "GAF013",
  dbFlags: 1,
  t: "A400",
};

// Check if aircraft is interesting military
if (looksMilitary(plane)) {
  // Get country
  const country = getAircraftCountry(
    plane.r, // registration
    plane.hex, // ICAO hex
    undefined, // API country
    true // is military
  );

  console.log(country.countryCode); // 'DE'
}
```

### In Angular Frontend

```typescript
import { getCountryFromIcaoHex, looksMilitary } from "@plane-alert/shared";

// Use in services
const result = getCountryFromIcaoHex("3f717c");
console.log(result.countryCode); // 'DE'
console.log(result.confidence); // 'high'
console.log(result.source); // 'icao-hex'
```

## Build Outputs

The package builds to three formats:

- **ESM** (`dist/esm/`) - For Angular and modern bundlers
- **CommonJS** (`dist/cjs/`) - For Node.js Cloud Functions
- **TypeScript Types** (`dist/types/`) - Type definitions for both

## Data Files

Located in `data/`:

- `icao-country-ranges.json` - Comprehensive ICAO hex allocation ranges
- `registration-country-prefix.json` - Aircraft registration prefix to country mappings

## Key Functions

### Country Detection

- `getAircraftCountry(registration?, icaoHex?, apiCountry?, isMilitary?)` - Main country detection with priority system
- `getCountryFromIcaoHex(icaoHex)` - Country from ICAO hex code
- `getCountryFromRegistration(registration)` - Country from registration prefix

### Military Detection

- `looksMilitary(plane)` - Determines if aircraft is interesting military (excludes trainers/business jets)
- `isMilitaryCallsign(callsign)` - Checks callsign against known military prefixes
- `normalizeCallsign(callsign)` - Cleans callsign for comparison

### Geographic Utilities

- `haversineDistanceKm(lat1, lon1, lat2, lon2)` - Distance between two points
- `computeBearing(lat1, lon1, lat2, lon2)` - Bearing from point A to point B
- `bearingToCardinal(bearing)` - Converts bearing to cardinal direction (N, NE, etc.)
- `formatDistance(km, unit)` - Formats distance with proper unit

## Maintenance

### Updating ICAO Ranges

When ICAO allocations change, update `data/icao-country-ranges.json`, rebuild, and redeploy both frontend and backend.

### Adding Aircraft Types

To add aircraft types to the "boring" list:

1. Edit `src/military-detection.ts` → `BORING_AIRCRAFT_TYPES`
2. Rebuild library
3. Redeploy both systems

## Version Management

This library uses semantic versioning:

- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes

Both frontend and backend should pin to the same version to ensure consistency.
