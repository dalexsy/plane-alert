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
   * Returns the operator name for a given callsign (first 3 letters), or undefined if not found.
   */
  getOperator(callSign: string): string | undefined {
    if (!callSign || callSign.length < 3) {
      return undefined;
    }
    const prefix = callSign.slice(0, 3).toUpperCase();
    return this.operatorMap[prefix];
  }

  /**
   * Returns the operator name for a given callsign and logs unknown call signs.
   * This is the recommended method to use when you want to track unknown operators.
   */
  getOperatorWithLogging(callSign: string): string | undefined {
    if (!callSign || callSign.length < 3) {
      return undefined;
    }

    const prefix = callSign.slice(0, 3).toUpperCase();
    const operator = this.operatorMap[prefix]; // Log unknown call signs (but only once per prefix to avoid spam)
    if (!operator && !this.unknownCallSigns.has(prefix)) {
      console.log(`Unknown call sign: ${prefix} (${callSign})`);
      this.unknownCallSigns.add(prefix);
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
