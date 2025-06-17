import { Injectable } from '@angular/core';
import { OPERATOR_SYMBOLS } from '../config/operator-symbols.config';

@Injectable({
  providedIn: 'root',
})
export class OperatorTooltipService {
  constructor() {}

  // Get operator symbol config for a plane
  private getSymbolConfig(plane: any) {
    const country = plane.country?.toLowerCase();
    return OPERATOR_SYMBOLS.find(
      (cfg) => plane.isMilitary && country && cfg.countries.includes(country)
    );
  }

  /** Get the left tooltip content (symbol) based on config */
  getLeftTooltipContent(plane: any): string {
    const cfg = this.getSymbolConfig(plane);
    return cfg
      ? `<span class="operator-symbol ${cfg.key}"><img src="assets/operator-logos/${cfg.svgFileName}" alt="${cfg.key}" /></span>`
      : '';
  }

  /** No additional tooltip classes; content icon is styled generically */
  getTooltipClasses(plane: any): string {
    return '';
  }
}
