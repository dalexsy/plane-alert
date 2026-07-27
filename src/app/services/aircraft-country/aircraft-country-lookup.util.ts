import { HttpClient } from '@angular/common/http';
import { ICAO_LOOKUP_CONFIG } from '../../config/icao-allocations.config';
import type { CountryDetectionResult, IcaoCountryRange } from './aircraft-country-types';

export async function loadIcaoCountryRanges(http: HttpClient): Promise<IcaoCountryRange[]> {
  try {
    const rawRanges = await http
      .get<Omit<IcaoCountryRange, 'startDec' | 'finishDec'>[]>('/assets/data/icao-country-ranges.json')
      .toPromise();
    return (rawRanges || []).map((r) => ({
      ...r,
      startDec: parseInt(r.startHex, 16),
      finishDec: parseInt(r.finishHex, 16),
    }));
  } catch {
    return [];
  }
}

export function getCountryFromRegistrationDetailed(
  registration: string,
  prefixMap: Record<string, string>
): CountryDetectionResult {
  const reg = registration.trim().toUpperCase();
  const sortedPrefixes = Object.keys(prefixMap).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (reg.startsWith(prefix)) {
      return {
        countryCode: prefixMap[prefix],
        confidence: 'high',
        source: 'registration',
        metadata: { registrationPrefix: prefix },
      };
    }
  }
  return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
}

export function getCountryFromMilitaryRegistration(
  registration: string
): CountryDetectionResult {
  const reg = registration.trim().toUpperCase();
  if (/^\d{2}\+\d{2}$/.test(reg)) {
    return {
      countryCode: 'DE',
      confidence: 'high',
      source: 'military-pattern',
      metadata: { militaryPattern: 'German military registration' },
    };
  }
  if (/^MM\d+/.test(reg)) {
    return {
      countryCode: 'IT',
      confidence: 'high',
      source: 'military-pattern',
      metadata: { militaryPattern: 'Italian military registration' },
    };
  }
  return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
}

export function getCountryFromIcaoHexDetailed(
  icaoHex: string,
  ranges: IcaoCountryRange[],
  lookupCache: Map<string, { result: string; timestamp: number }>
): CountryDetectionResult {
  let cleanIcaoHex = icaoHex.startsWith('~') ? icaoHex.substring(1) : icaoHex;
  const cacheKey = `icao:${cleanIcaoHex.toLowerCase()}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ICAO_LOOKUP_CONFIG.cacheMaxAge) {
    return { countryCode: cached.result, confidence: 'medium', source: 'icao-hex' };
  }
  if (!cleanIcaoHex || !/^[0-9A-Fa-f]+$/.test(cleanIcaoHex)) {
    return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
  }
  try {
    const icaoDec = parseInt(cleanIcaoHex, 16);
    for (const range of ranges) {
      if (icaoDec >= range.startDec! && icaoDec <= range.finishDec!) {
        lookupCache.set(cacheKey, { result: range.countryISO2, timestamp: Date.now() });
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
  return { countryCode: 'Unknown', confidence: 'low', source: 'unknown' };
}

export function debugIcaoAllocation(icaoHex: string, ranges: IcaoCountryRange[]): object {
  const icaoDec = parseInt(icaoHex, 16);
  for (const range of ranges) {
    if (icaoDec >= range.startDec! && icaoDec <= range.finishDec!) {
      return {
        found: true,
        source: 'comprehensive',
        country: range.countryISO2,
        range: `${range.startHex}-${range.finishHex}`,
        isMilitary: range.isMilitary,
      };
    }
  }
  console.log('❌ No allocation found for this ICAO');
  return { found: false };
}
