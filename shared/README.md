# @plane-alert/shared

Shared aircraft detection and classification logic for Plane Alert.

## Overview

Pure TypeScript helpers for:

- **Country detection** — ICAO hex and registration prefixes
- **Military detection** — interesting military aircraft (filters trainers / generic GA)
- **Geographic utilities** — distance, bearing, formatting
- **Pushover device matching** — server-side delivery target resolution (optional legacy alerts)

## Why this exists

The **Angular PWA** and **planes-api** (`functions/` on dryl-prod) must classify aircraft the same way. This package is the single source of truth.

## Installation

```bash
cd shared
npm install
npm run build
```

The app runs `npm run build:shared` in `prebuild`. planes-api copies the build via `shared-package/`.

## Usage

### In planes-api (Node.js)

```typescript
import { looksMilitary, getAircraftCountry } from "@plane-alert/shared";

const plane = { hex: "3f717c", flight: "GAF013", dbFlags: 1, t: "A400" };

if (looksMilitary(plane)) {
  const country = getAircraftCountry(plane.r, plane.hex, undefined, true);
  console.log(country.countryCode);
}
```

### In the Angular app

```typescript
import { getCountryFromIcaoHex, looksMilitary } from "@plane-alert/shared";

const result = getCountryFromIcaoHex("3f717c");
```

## Build outputs

- `dist/esm/` — Angular / modern bundlers
- `dist/cjs/` — Node (planes-api)
- `dist/types/` — Type definitions

## Data files

Under `data/`:

- `icao-country-ranges.json`
- `registration-country-prefix.json`

## Key functions

See source exports in `src/index.ts` — country helpers, `looksMilitary`, `haversineDistanceKm`, Pushover matching helpers, etc.

## Maintenance

After changing detection rules or data files: rebuild shared, rebuild planes-api, redeploy SPA and API so both sides stay aligned.
