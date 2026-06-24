import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import registrationCountryPrefix from '../../assets/data/registration-country-prefix.json';
import { ICAO_LOOKUP_CONFIG } from '../config/icao-allocations.config';
import {
  COORDINATE_COUNTRY_BOUNDARIES,
  CountryDetectionResult,
  IcaoCountryRange,
} from './aircraft-country/aircraft-country-types';
import {
  debugIcaoAllocation as debugIcaoAllocationFn,
  getCountryFromIcaoHexDetailed,
  getCountryFromRegistrationDetailed,
  loadIcaoCountryRanges,
} from './aircraft-country/aircraft-country-lookup.util';

export type { CountryDetectionResult, IcaoCountryRange } from './aircraft-country/aircraft-country-types';

@Injectable({ providedIn: 'root' })
export class AircraftCountryService {
  private readonly REGISTRATION_COUNTRY_PREFIX = registrationCountryPrefix as Record<string, string>;
  private readonly lookupCache = new Map<string, { result: string; timestamp: number }>();
  private icaoCountryRanges: IcaoCountryRange[] = [];
  private icaoRangesLoaded = false;
  private icaoRangesPromise: Promise<void>;

  constructor(private http: HttpClient) {
    this.icaoRangesPromise = loadIcaoCountryRanges(this.http).then((ranges) => {
      this.icaoCountryRanges = ranges;
      this.icaoRangesLoaded = true;
    });
  }

  private async ensureRangesLoaded(): Promise<void> {
    if (!this.icaoRangesLoaded) await this.icaoRangesPromise;
  }

  getAircraftCountryDetailed(
    registration?: string,
    icaoHex?: string,
    apiCountry?: string,
    isMilitary?: boolean
  ): CountryDetectionResult {
    if (isMilitary && icaoHex && ICAO_LOOKUP_CONFIG.enableIcaoLookup) {
      const icaoResult = getCountryFromIcaoHexDetailed(icaoHex, this.icaoCountryRanges, this.lookupCache);
      if (icaoResult.countryCode !== 'Unknown') return icaoResult;
    }
    if (registration) {
      const regResult = getCountryFromRegistrationDetailed(registration, this.REGISTRATION_COUNTRY_PREFIX);
      if (regResult.countryCode !== 'Unknown') return regResult;
    }
    if (icaoHex && ICAO_LOOKUP_CONFIG.enableIcaoLookup && !isMilitary) {
      const icaoResult = getCountryFromIcaoHexDetailed(icaoHex, this.icaoCountryRanges, this.lookupCache);
      if (icaoResult.countryCode !== 'Unknown') return icaoResult;
    }
    if (apiCountry && /^[A-Za-z]{2}$/.test(apiCountry)) {
      return { countryCode: apiCountry.toUpperCase(), confidence: 'high', source: 'api' };
    }
    return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
  }

  getAircraftCountry(registration?: string, icaoHex?: string, apiCountry?: string, isMilitary?: boolean): string {
    return this.getAircraftCountryDetailed(registration, icaoHex, apiCountry, isMilitary).countryCode;
  }

  getCountryFromCoordinates(latitude: number, longitude: number): CountryDetectionResult {
    for (const boundary of COORDINATE_COUNTRY_BOUNDARIES) {
      const { bounds } = boundary;
      if (latitude >= bounds.latMin && latitude <= bounds.latMax && longitude >= bounds.lonMin && longitude <= bounds.lonMax) {
        return {
          countryCode: boundary.countryCode,
          confidence: 'medium',
          source: 'api',
          metadata: { coordinateBounds: bounds },
        };
      }
    }
    return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
  }

  getRegistrationPrefixesForCountry(countryCode: string): string[] {
    const prefixes: string[] = [];
    for (const [prefix, country] of Object.entries(this.REGISTRATION_COUNTRY_PREFIX)) {
      if (country === countryCode.toUpperCase()) prefixes.push(prefix);
    }
    return prefixes.sort();
  }

  isKnownCountry(countryCode: string): boolean {
    return Object.values(this.REGISTRATION_COUNTRY_PREFIX).includes(countryCode.toUpperCase());
  }

  getAircraftInfo(registration?: string, icaoHex?: string, apiCountry?: string, isMilitary?: boolean) {
    const result = this.getAircraftCountryDetailed(registration, icaoHex, apiCountry, isMilitary);
    return {
      ...result,
      diagnostics: {
        hasRegistration: !!registration,
        hasIcaoHex: !!icaoHex,
        hasApiCountry: !!apiCountry,
        registrationPrefixes:
          result.countryCode !== 'Unknown' ? this.getRegistrationPrefixesForCountry(result.countryCode) : [],
        icaoAllocations: [],
      },
    };
  }

  clearCache(): void {
    this.lookupCache.clear();
  }

  getCacheStats() {
    return {
      size: this.lookupCache.size,
      maxAge: ICAO_LOOKUP_CONFIG.cacheMaxAge,
      entries: Array.from(this.lookupCache.entries()).map(([key, value]) => ({
        key,
        result: value.result,
        age: Date.now() - value.timestamp,
      })),
    };
  }

  debugIcaoAllocation(icaoHex: string): object {
    return debugIcaoAllocationFn(icaoHex, this.icaoCountryRanges);
  }
}
