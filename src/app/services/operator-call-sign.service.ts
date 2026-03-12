import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class OperatorCallSignService {
  private operatorMap: Record<string, string> = {};
  private userOperatorMap: Record<string, string> = {};
  private unknownCallSigns = new Set<string>();
  private readonly USER_OPERATORS_KEY = 'plane-alert-user-operators';

  constructor(private http: HttpClient) {
    this.loadMappings();
  }

  /** Load mappings from JSON asset */
  private loadMappings(): void {
    this.http
      .get<Record<string, string>>('assets/operator-call-signs.json')
      .subscribe((data) => {
        this.operatorMap = data;
        this.loadUserData();
      });
  }

  private loadUserData(): void {
    const stored = localStorage.getItem(this.USER_OPERATORS_KEY);
    if (stored) {
      try {
        this.userOperatorMap = JSON.parse(stored);
      } catch (e) {
        console.error('Error loading user operator data:', e);
      }
    }
  }

  private saveUserData(): void {
    localStorage.setItem(
      this.USER_OPERATORS_KEY,
      JSON.stringify(this.userOperatorMap),
    );
  }

  /**
   * Returns the operator name for a given callsign by matching the longest possible prefix, or undefined if not found.
   * Prefix must be followed by a digit or be the entire callsign to match (prevents "SHADO" from matching "SHA").
   */
  getOperator(callSign: string): string | undefined {
    if (!callSign) {
      return undefined;
    }
    const cs = callSign.toUpperCase();
    // Check user map first
    const userPrefixes = Object.keys(this.userOperatorMap).sort(
      (a, b) => b.length - a.length,
    );
    for (const prefix of userPrefixes) {
      // Avoid bogus matches from very short prefixes (e.g. ground vehicles like "B352").
      // ICAO operator/callsign prefixes are typically 3+ letters.
      if (prefix.length < 3) continue;
      if (
        cs === prefix ||
        (cs.startsWith(prefix) && /^\d/.test(cs.slice(prefix.length)))
      ) {
        return this.userOperatorMap[prefix];
      }
    }
    // Then check main map
    const prefixes = Object.keys(this.operatorMap).sort(
      (a, b) => b.length - a.length,
    );
    for (const prefix of prefixes) {
      // Avoid bogus matches from very short prefixes (e.g. ground vehicles like "B352").
      if (prefix.length < 3) continue;
      if (
        cs === prefix ||
        (cs.startsWith(prefix) && /^\d/.test(cs.slice(prefix.length)))
      ) {
        return this.operatorMap[prefix];
      }
    }
    return undefined;
  }

  /**
   * Returns the operator name for a given callsign and logs unknown call signs.
   * Matches the longest possible prefix, but logs using the first three letters if unknown.
   * Prefix must be followed by a digit or be the entire callsign to match (prevents "SHADO" from matching "SHA").
   */
  getOperatorWithLogging(callSign: string): string | undefined {
    if (!callSign) {
      return undefined;
    }
    const cs = callSign.toUpperCase();
    const prefixes = Object.keys(this.operatorMap).sort(
      (a, b) => b.length - a.length,
    );
    let foundPrefix: string | undefined;
    for (const prefix of prefixes) {
      if (prefix.length < 3) continue;
      if (
        cs === prefix ||
        (cs.startsWith(prefix) && /^\d/.test(cs.slice(prefix.length)))
      ) {
        foundPrefix = prefix;
        break;
      }
    }
    const operator = foundPrefix ? this.operatorMap[foundPrefix] : undefined;
    // Log unknown call signs on first unseen prefix (using first 3 letters)
    // Extract entire prefix until first digit (so names like LIFTER are fully captured)
    const prefixMatch = cs.match(/^[^0-9]+/);
    const logPrefix = prefixMatch ? prefixMatch[0] : cs;
    if (
      logPrefix.length >= 3 &&
      !operator &&
      !this.unknownCallSigns.has(logPrefix)
    ) {
      // Only log alphabetic prefixes (skip all-digit or N-prefix, VFR/IFR)
      if (
        !/^\d+$/.test(callSign) &&
        !logPrefix.startsWith('N') &&
        logPrefix !== 'VFR' &&
        logPrefix !== 'IFR'
      ) {
        // Add new prefix silently (avoid expensive hot-path console output)
        this.unknownCallSigns.add(logPrefix);
      }
    }

    return operator;
  }

  /**
   * Returns a copy of all current prefix→operator mappings.
   */
  getAllMappings(): Record<string, string> {
    return { ...this.userOperatorMap, ...this.operatorMap };
  }

  /**
   * Adds or updates a mapping for a 3-letter prefix.
   */
  addMapping(prefix: string, operatorName: string): void {
    this.userOperatorMap[prefix.toUpperCase()] = operatorName;
    this.saveUserData();
  }

  /**
   * Removes a mapping by its 3-letter prefix.
   */
  removeMapping(prefix: string): void {
    delete this.userOperatorMap[prefix.toUpperCase()];
    this.saveUserData();
  }

  /**
   * Returns a copy of all user-added prefix→operator mappings.
   */
  getUserMappings(): Record<string, string> {
    return { ...this.userOperatorMap };
  }

  /**
   * Imports multiple operator mappings.
   */
  importMappings(mappings: Record<string, string>): void {
    Object.assign(this.userOperatorMap, mappings);
    this.saveUserData();
  }

  /**
   * Returns a copy of all unknown call sign prefixes that have been logged.
   */
  getUnknownCallSigns(): string[] {
    return Array.from(this.unknownCallSigns).sort();
  }

  /**
   * Clears the log of unknown call signs. Useful for resetting the logging.
   */
  clearUnknownCallSigns(): void {
    this.unknownCallSigns.clear();
  }
}
