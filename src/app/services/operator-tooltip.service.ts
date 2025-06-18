import { Injectable } from '@angular/core';
import { OPERATOR_SYMBOLS } from '../config/operator-symbols.config';

@Injectable({
  providedIn: 'root',
})
export class OperatorTooltipService {
  constructor() {}

  // Get operator symbol config for a plane
  public getSymbolConfig(plane: any) {
    if (!plane.isMilitary) {
      return null;
    }

    const country = plane.country?.toLowerCase();
    const operator = plane.operator?.toLowerCase();

    // First, try to match by specific operator name
    if (operator) {
      const operatorMatch = OPERATOR_SYMBOLS.find(
        (cfg) =>
          cfg.operators &&
          cfg.operators.some(
            (op) =>
              operator.includes(op.toLowerCase()) ||
              op.toLowerCase().includes(operator)
          )
      );
      if (operatorMatch) {
        return operatorMatch;
      }
    }

    // Fall back to country-based matching
    if (country) {
      const countryMatch = OPERATOR_SYMBOLS.find((cfg) =>
        cfg.countries.includes(country)
      );
      return countryMatch || null;
    }

    return null;
  }
  /** Get the left tooltip content (symbol) based on config */
  getLeftTooltipContent(plane: any): string {
    const cfg = this.getSymbolConfig(plane);
    return cfg
      ? `<span class="operator-symbol ${cfg.key}"><img src="assets/operator-logos/${cfg.svgFileName}" alt="${cfg.key}" title="${cfg.key}"/></span>`
      : '';
  }

  /** No additional tooltip classes; content icon is styled generically */
  getTooltipClasses(plane: any): string {
    return '';
  }
}
