import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class OperatorCallSignService {
  private operatorMap: Record<string, string> = {};
  private unknownCallSigns = new Set<string>();

  constructor(private http: HttpClient) {
    this.loadMappings();
  }

  /** Load mappings from JSON asset */
  private loadMappings(): void {
    this.http
      .get<Record<string, string>>('assets/operator-call-signs.json')
      .subscribe((data) => (this.operatorMap = data));
  }
  /**
   * Returns the operator name for a given callsign by matching the longest possible prefix, or undefined if not found.
   */
  getOperator(callSign: string): string | undefined {
    if (!callSign) {
      return undefined;
    }
    const cs = callSign.toUpperCase();
    // Try longest map keys first
    const prefixes = Object.keys(this.operatorMap).sort(
      (a, b) => b.length - a.length
    );
    for (const prefix of prefixes) {
      if (cs.startsWith(prefix)) {
        return this.operatorMap[prefix];
      }
    }
    return undefined;
  }

  /**
   * Returns the operator name for a given callsign and logs unknown call signs.
   * Matches the longest possible prefix, but logs using the first three letters if unknown.
   */
  getOperatorWithLogging(callSign: string): string | undefined {
    if (!callSign) {
      return undefined;
    }
    const cs = callSign.toUpperCase();
    const prefixes = Object.keys(this.operatorMap).sort(
      (a, b) => b.length - a.length
    );
    let foundPrefix: string | undefined;
    for (const prefix of prefixes) {
      if (cs.startsWith(prefix)) {
        foundPrefix = prefix;
        break;
      }
    }
    const operator = foundPrefix ? this.operatorMap[foundPrefix] : undefined;
    // Log unknown call signs on first unseen prefix (using first 3 letters)
    // Extract entire prefix until first digit (so names like LIFTER are fully captured)
    const prefixMatch = cs.match(/^[^0-9]+/);
    const logPrefix = prefixMatch ? prefixMatch[0] : cs;
    if (!operator && !this.unknownCallSigns.has(logPrefix)) {
      // Only log alphabetic prefixes (skip all-digit or N-prefix, VFR/IFR)
      if (
        !/^\d+$/.test(callSign) &&
        !logPrefix.startsWith('N') &&
        logPrefix !== 'VFR' &&
        logPrefix !== 'IFR'
      ) {
        // Add new prefix then output entire set formatted for JSON
        this.unknownCallSigns.add(logPrefix);
        console.log(
          [...this.unknownCallSigns].map((p) => `"${p}": ""`).join(', ')
        );
      }
    }

    return operator;
  }

  /**
   * Returns a copy of all current prefix→operator mappings.
   */
  getAllMappings(): Record<string, string> {
    return { ...this.operatorMap };
  }

  /**
   * Adds or updates a mapping for a 3-letter prefix.
   */
  addMapping(prefix: string, operatorName: string): void {
    this.operatorMap[prefix.toUpperCase()] = operatorName;
  }
  /**
   * Removes a mapping by its 3-letter prefix.
   */
  removeMapping(prefix: string): void {
    delete this.operatorMap[prefix.toUpperCase()];
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
