import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PlaneFilterService {
  private localStorageKey = 'blockedPrefixes';
  // Special key to represent planes with no callsign
  private readonly NO_CALLSIGN_KEY = '__NO_CALLSIGN__';
  private defaultPrefixes: string[] = [
    'RYR',
    'DLH',
    'WZZ',
    'AUA',
    'EJU',
    'NSZ',
    'KLM',
    'LOT',
    'AFR',
    'SAS',
    'UAE',
    'EZJ',
    'EZY',
    'PGT',
    'LHX',
    'THY',
    'IBS',
    'EWG',
    'BAW',
    'DMY',
    'PVD',
    'DHA',
    'NJE',
    'CHX',
    'DME',
    'SWR',
    'SXS',
    'VLG',
    'AEE',
    'ETH',
    'CCA',
    'FIN',
    'TVF',
    'EIN',
    'VJH',
    'BEL',
    'NOZ',
    'CXI',
    'CAO',
  ];
  private prefixes: string[];

  constructor() {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.prefixes = parsed;
        } else {
          this.prefixes = [...this.defaultPrefixes];
        }
      } catch (e) {
        this.prefixes = [...this.defaultPrefixes];
      }
    } else {
      this.prefixes = [...this.defaultPrefixes];
    }
  }

  getFilterPrefixes(): string[] {
    return this.prefixes;
  }

  addPrefix(prefix: string): boolean {
    if (prefix === this.NO_CALLSIGN_KEY) {
      if (!this.prefixes.includes(this.NO_CALLSIGN_KEY)) {
        this.prefixes.push(this.NO_CALLSIGN_KEY);
        localStorage.setItem(
          this.localStorageKey,
          JSON.stringify(this.prefixes)
        );
        return true;
      }
      return false;
    }

    const clean = prefix.trim().toUpperCase().slice(0, 3);
    if (!this.prefixes.includes(clean)) {
      this.prefixes.push(clean);
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.prefixes));
      return true;
    }
    return false;
  }

  removePrefix(prefix: string): boolean {
    if (prefix === this.NO_CALLSIGN_KEY) {
      const index = this.prefixes.indexOf(this.NO_CALLSIGN_KEY);
      if (index !== -1) {
        this.prefixes.splice(index, 1);
        localStorage.setItem(
          this.localStorageKey,
          JSON.stringify(this.prefixes)
        );
        return true;
      }
      return false;
    }

    const clean = prefix.trim().toUpperCase().slice(0, 3);
    const index = this.prefixes.indexOf(clean);
    if (index !== -1) {
      this.prefixes.splice(index, 1);
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.prefixes));
      return true;
    }
    return false;
  }

  togglePrefix(prefix: string | null): void {
    if (!prefix) return;
    if (this.prefixes.includes(prefix)) {
      this.removePrefix(prefix);
    } else {
      this.addPrefix(prefix);
    }
  }

  extractAirlinePrefix(callsign: string): string {
    if (!callsign || callsign.trim() === '') {
      return this.NO_CALLSIGN_KEY;
    }
    return callsign.trim().substring(0, 3).toUpperCase();
  }

  // Initialize the filter system and properly handle the first-load scenario
  initializeFiltering(excludeDiscount: boolean): void {}

  // Determines if a plane should be filtered based on its callsign
  shouldIncludeCallsign(
    callsign: string,
    excludeCommercial: boolean,
    blockedPrefixes: string[],
    isMilitary: boolean = false
  ): boolean {
    // Always include military planes regardless of callsign
    if (isMilitary) {
      return true;
    }

    // If exclusion is disabled, include all planes
    if (!excludeCommercial) {
      return true;
    }

    // Handle empty callsigns - check if no-callsign planes are blocked
    if (!callsign || callsign.trim() === '') {
      const noCallsignFiltered = blockedPrefixes.includes(this.NO_CALLSIGN_KEY);
      return !noCallsignFiltered;
    }

    const prefix = this.extractAirlinePrefix(callsign);
    const isBlocked = blockedPrefixes.includes(prefix);
    return !isBlocked;
  }

  // Determines if a plane would be filtered when filters are active, regardless of current filter state
  isPlaneFiltered(callsign: string, isMilitary: boolean = false): boolean {
    // Military planes should never be filtered
    if (isMilitary) {
      return false;
    }

    // Planes with no callsign - check if they're in the filter list
    if (!callsign || callsign.trim() === '') {
      return this.prefixes.includes(this.NO_CALLSIGN_KEY);
    }

    const prefix = this.extractAirlinePrefix(callsign);
    return this.prefixes.includes(prefix);
  }

  // Toggle the filter status for planes with no callsign
  toggleNoCallsignFilter(): boolean {
    if (this.prefixes.includes(this.NO_CALLSIGN_KEY)) {
      this.removePrefix(this.NO_CALLSIGN_KEY);
      return false; // No longer filtered
    } else {
      this.addPrefix(this.NO_CALLSIGN_KEY);
      return true; // Now filtered
    }
  }

  // Check if planes with no callsign are being filtered
  areNoCallsignPlanesFiltered(): boolean {
    return this.prefixes.includes(this.NO_CALLSIGN_KEY);
  }
}
