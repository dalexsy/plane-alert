import { Injectable } from '@angular/core';
import { OPERATOR_SYMBOLS } from '../config/operator-symbols.config';
import { AircraftCountryService } from './aircraft-country.service';

// Normalized interface for operator symbol lookup
interface NormalizedPlaneData {
  icao: string;
  callsign?: string;
  operator?: string;
  country?: string;
  isMilitary?: boolean;
  lat?: number;
  lon?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OperatorTooltipService {
  constructor(private aircraftCountryService: AircraftCountryService) {}

  /**
   * Normalize plane data to ensure consistent field access regardless of source
   * Handles both PlaneLogEntry (with 'origin') and map marker data (with 'country')
   */
  private normalizePlaneData(plane: any): NormalizedPlaneData {
    return {
      icao: plane.icao || '',
      callsign: plane.callsign || '',
      operator: plane.operator || '',
      // Handle both 'origin' and 'country' fields for consistent access
      country: plane.country || plane.origin || '',
      isMilitary: plane.isMilitary || false,
      lat: plane.lat,
      lon: plane.lon,
    };
  }

  // Get country with fallback chain for better location detection
  private getCountryWithFallback(plane: NormalizedPlaneData): string | null {
    // First try: Use the detected country from normalized data
    if (plane.country && plane.country !== 'Unknown') {
      return plane.country.toLowerCase();
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
  /**
   * Get operator symbol config for a plane with robust data normalization and debugging
   */
  public getSymbolConfig(plane: any) {
    // Normalize the data to handle different input formats
    const normalizedPlane = this.normalizePlaneData(plane);
    const country = this.getCountryWithFallback(normalizedPlane);
    const operator = (normalizedPlane.operator || '').toLowerCase();

    // Debug logging to help track down inconsistencies
    if (normalizedPlane.icao) {
      console.debug(
        `[OperatorTooltip] Processing plane ${normalizedPlane.icao}:`,
        {
          originalInput: {
            country: plane.country,
            origin: plane.origin,
            operator: plane.operator,
          },
          normalized: {
            country: normalizedPlane.country,
            operator: normalizedPlane.operator,
          },
          resolvedCountry: country,
          isMilitary: normalizedPlane.isMilitary,
        }
      );
    }

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
        console.debug(
          `[OperatorTooltip] Found operator match for ${normalizedPlane.icao}:`,
          operatorMatch.key
        );
        return operatorMatch;
      }
    } // Fall back to country-based matching ONLY for military aircraft
    // This prevents civilian airlines from showing military logos
    if (country && normalizedPlane.isMilitary) {
      const countryMatch = OPERATOR_SYMBOLS.find((cfg) =>
        cfg.countries?.includes(country)
      );
      if (countryMatch) {
        console.debug(
          `[OperatorTooltip] Found country match for military aircraft ${normalizedPlane.icao}:`,
          countryMatch.key
        );
        return countryMatch;
      }
    }

    console.debug(
      `[OperatorTooltip] No match found for ${normalizedPlane.icao}`
    );
    return null;
  } /** Get the left tooltip content (symbol) based on config */
  getLeftTooltipContent(plane: any): string {
    const cfg = this.getSymbolConfig(plane);
    return cfg
      ? `<span class="operator-symbol"><img src="assets/operator-logos/${cfg.key}.svg" alt="${cfg.key}" title="${cfg.key}"/></span>`
      : '';
  }

  /** No additional tooltip classes; content icon is styled generically */
  getTooltipClasses(plane: any): string {
    return '';
  }
}
