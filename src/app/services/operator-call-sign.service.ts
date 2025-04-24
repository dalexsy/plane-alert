import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OperatorCallSignService {
  constructor() {}

  // mapping of 3-letter call-sign prefixes to operator names
  private operatorMap: Record<string, string> = {
    CTN: 'Croatia Airlines',
    DLH: 'Deutsche Lufthansa',
    KLM: 'KLM Royal Dutch Airlines',
    RYR: 'Ryanair',
    XXX: 'Ryanair',
    LHX: 'Lufthansa City',
    EIN: 'Aer Lingus',
    NOZ: 'Norwegian Air',
    EJU: 'easyjet',
    ASL: 'GetJet Airlines',
    WUK: 'Wizz Air UK',
    AUA: 'Austrian Airlines',
    BTI: 'air Baltic',
    FHY: 'Freebird Airlines',
    AHY: 'Azerbaijan Airlines',
    IBS: 'Iberia Express',
  };

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
}
