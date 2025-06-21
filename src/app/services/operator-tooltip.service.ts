import { Injectable } from '@angular/core';
import { OPERATOR_SYMBOLS } from '../config/operator-symbols.config';
import { AircraftCountryService } from './aircraft-country.service';

@Injectable({
  providedIn: 'root',
})
export class OperatorTooltipService {
  constructor(private aircraftCountryService: AircraftCountryService) {}

  // Get country with fallback chain for better location detection
  private getCountryWithFallback(plane: any): string | null {
    // First try: Use the detected country from plane.origin
    if (plane.origin && plane.origin !== 'Unknown') {
      return plane.origin.toLowerCase();
    }

    // Second try: Use coordinates to determine country
    if (typeof plane.lat === 'number' && typeof plane.lon === 'number') {
      const coordResult = this.aircraftCountryService.getCountryFromCoordinates(
        plane.lat,
        plane.lon
      );
      if (coordResult.countryCode !== 'Unknown') {
        return coordResult.countryCode.toLowerCase();
      }
    }

    // Third try: Use registration or ICAO for country detection
    if (plane.callsign || plane.icao) {
      const detectionResult =
        this.aircraftCountryService.getAircraftCountryDetailed(
          plane.callsign,
          plane.icao
        );
      if (detectionResult.countryCode !== 'Unknown') {
        return detectionResult.countryCode.toLowerCase();
      }
    }

    return null;
  }

  // Get operator symbol config for a plane
  public getSymbolConfig(plane: any) {
    const country = this.getCountryWithFallback(plane);
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

    // Fall back to country-based matching for military aircraft
    if (plane.isMilitary && country) {
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
      ? `<span class="operator-symbol ${cfg.key}"><img src="assets/operator-logos/${cfg.key}.svg" alt="${cfg.key}" title="${cfg.key}"/></span>`
      : '';
  }

  /** No additional tooltip classes; content icon is styled generically */
  getTooltipClasses(plane: any): string {
    return '';
  }
}
