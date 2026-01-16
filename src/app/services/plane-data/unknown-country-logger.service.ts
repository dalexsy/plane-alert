import { Injectable } from '@angular/core';

interface UnknownCountryAircraft {
  icao: string;
  registration: string;
  operator: string;
  rawCountry: string;
  callsign: string;
  detectedCountry: string;
  isMilitary: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UnknownCountryLoggerService {
  private loggedUnknownCountries = new Set<string>();
  private unknownCountryAircraft: UnknownCountryAircraft[] = [];
  private lastUnknownCountryLogTime = 0;

  logUnknownCountryIfNeeded(params: {
    icao: string;
    registration: string;
    operator: string;
    rawCountry: string;
    callsign: string;
    detectedCountry: string;
    isMilitary: boolean;
  }): void {
    const {
      icao,
      registration,
      operator,
      rawCountry,
      callsign,
      detectedCountry,
      isMilitary,
    } = params;

    if (
      (detectedCountry === 'Unknown' ||
        (isMilitary && detectedCountry !== 'Unknown')) &&
      !this.loggedUnknownCountries.has(icao)
    ) {
      this.unknownCountryAircraft.push({
        icao,
        registration: registration || 'N/A',
        operator: operator || 'N/A',
        rawCountry: rawCountry || 'N/A',
        callsign: callsign || 'N/A',
        detectedCountry,
        isMilitary,
      });
      this.loggedUnknownCountries.add(icao);
    }

    // Log batch every 30 seconds
    const now = Date.now();
    if (
      now - this.lastUnknownCountryLogTime > 30000 &&
      this.unknownCountryAircraft.length > 0
    ) {
      // Unknown aircraft logged for debugging (removed console output for cleaner logs)
      this.unknownCountryAircraft = [];
      this.lastUnknownCountryLogTime = now;
    }
  }
}
