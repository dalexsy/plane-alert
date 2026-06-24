export interface CountryDetectionResult {
  countryCode: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'api' | 'registration' | 'military-pattern' | 'icao-hex' | 'unknown';
  metadata?: {
    registrationPrefix?: string;
    icaoAllocation?: any;
    militaryPattern?: string;
    coordinateBounds?: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  };
}

export interface IcaoCountryRange {
  startHex: string;
  finishHex: string;
  isMilitary: boolean;
  countryISO2: string;
  startDec?: number;
  finishDec?: number;
}

export const COORDINATE_COUNTRY_BOUNDARIES = [
  { countryCode: 'DE', name: 'Germany', bounds: { latMin: 47, latMax: 55, lonMin: 6, lonMax: 15 } },
  { countryCode: 'FR', name: 'France', bounds: { latMin: 42, latMax: 51, lonMin: -5, lonMax: 8 } },
  { countryCode: 'ES', name: 'Spain', bounds: { latMin: 36, latMax: 44, lonMin: -10, lonMax: 3 } },
  { countryCode: 'IT', name: 'Italy', bounds: { latMin: 36, latMax: 47, lonMin: 6, lonMax: 19 } },
  { countryCode: 'NL', name: 'Netherlands', bounds: { latMin: 50, latMax: 54, lonMin: 3, lonMax: 7 } },
];
