// src/app/services/helicopter-identification.service.ts
import { Injectable } from '@angular/core';
import { HelicopterListService } from './helicopter-list.service';

/**
 * Enterprise-ready helicopter identification service
 * Provides centralized helicopter detection logic to prevent sync issues
 * between map view and window view helicopter identification
 */
@Injectable({
  providedIn: 'root',
})
export class HelicopterIdentificationService {
  constructor(private helicopterListService: HelicopterListService) {}

  /**
   * Comprehensive helicopter identification using ICAO, model patterns, and operator call signs
   * This method combines all helicopter detection logic in one place to ensure
   * consistent identification across all components
   *
   * @param icao - Aircraft ICAO code
   * @param model - Aircraft model string (optional)
   * @param operator - Aircraft operator call sign (optional)
   * @returns true if aircraft should be treated as a helicopter
   */
  isHelicopter(icao: string, model?: string, operator?: string): boolean {
    try {
      // First check the ICAO-based helicopter list (most authoritative)
      if (this.helicopterListService.isHelicopter(icao)) {
        return true;
      }

      // Check operator call sign patterns (second priority)
      if (operator && this.isHelicopterByOperator(operator)) {
        return true;
      }

      // If no model provided, can't do pattern matching
      if (!model || typeof model !== 'string') {
        return false;
      }

      // Check model name patterns (fallback)
      return this.isHelicopterByModel(model);
    } catch (error) {
      // Error in helicopter identification
      // Fail safe - default to false if there's any error
      return false;
    }
  }

  /**
   * Check if aircraft is a helicopter based on operator call sign patterns
   * This is used when ICAO is not in the helicopter list
   *
   * @param operator - Aircraft operator call sign
   * @returns true if operator indicates helicopter operations
   */
  private isHelicopterByOperator(operator: string): boolean {
    if (!operator || typeof operator !== 'string') {
      return false;
    }

    const operatorLower = operator.toLowerCase().trim();

    // Return early for empty strings
    if (!operatorLower) {
      return false;
    }

    // Known helicopter operator call signs
    const helicopterOperators = [
      'bpo', // Bundespolizei (German Federal Police) - helicopters
      'bpoli', // Bundespolizei variant
      'polizei', // Police helicopters
      'police', // Police helicopters
      'coast guard', // Coast guard helicopters
      'coastguard', // Coast guard helicopters
      'rescue', // Rescue helicopters
      'sar', // Search and Rescue
      'air ambulance', // Air ambulance
      'medevac', // Medical evacuation
      'ems', // Emergency Medical Services
    ];

    // Check if any pattern matches
    return helicopterOperators.some((pattern) =>
      operatorLower.includes(pattern)
    );
  }

  /**
   * Check if aircraft is a helicopter based on model name patterns
   * This is used as a fallback when ICAO and operator checks fail
   *
   * @param model - Aircraft model string
   * @returns true if model indicates helicopter
   */
  private isHelicopterByModel(model: string): boolean {
    if (!model || typeof model !== 'string') {
      return false;
    }

    const modelLower = model.toLowerCase().trim();

    // Return early for empty strings
    if (!modelLower) {
      return false;
    }

    // Known helicopter model patterns
    const helicopterPatterns = [
      'copter', // helicopter, eurocopter, etc.
      'helicopter', // explicit helicopter
      'heli', // heli, helibus, etc.
      'chopper', // chopper
      'r22', // Robinson R22
      'r44', // Robinson R44
      'r66', // Robinson R66
      'bell 206', // Bell helicopters
      'bell 407',
      'bell 412',
      'bell 429',
      'bell 430',
      'as350', // Airbus helicopters
      'as355',
      'as365',
      'ec120', // Eurocopter/Airbus
      'ec130',
      'ec135',
      'ec145',
      'ec155',
      'ec175',
      'ec225',
      'ec725',
      'h125', // Airbus H-series
      'h130',
      'h135',
      'h145',
      'h155',
      'h160',
      'h175',
      'h215',
      'h225',
      'uh-1', // Military helicopters
      'uh-60',
      'ah-64',
      'ch-47',
      'ch-53',
      'mi-8', // Russian helicopters
      'mi-17',
      'mi-24',
      'mi-26',
      'ka-32',
      's-76', // Sikorsky
      's-92',
      'aw109', // AgustaWestland/Leonardo
      'aw139',
      'aw149',
      'aw169',
      'aw189',
      'md500', // MD Helicopters
      'md520',
      'md530',
      'md600',
      'md900',
      'md902',
      'black hawk',
      'Chinook',
      'JetRanger',
    ];

    // Check if any pattern matches
    return helicopterPatterns.some((pattern) => modelLower.includes(pattern));
  }

  /**
   * Get detailed helicopter identification info for debugging
   * Useful for troubleshooting helicopter identification issues
   *
   * @param icao - Aircraft ICAO code
   * @param model - Aircraft model string (optional)
   * @param operator - Aircraft operator call sign (optional)
   * @returns object with identification details
   */
  getHelicopterIdentificationDetails(
    icao: string,
    model?: string,
    operator?: string
  ): {
    isHelicopter: boolean;
    identifiedByIcao: boolean;
    identifiedByOperator: boolean;
    identifiedByModel: boolean;
    model: string | undefined;
    operator: string | undefined;
    icao: string;
  } {
    const identifiedByIcao = this.helicopterListService.isHelicopter(icao);
    const identifiedByOperator = operator
      ? this.isHelicopterByOperator(operator)
      : false;
    const identifiedByModel = model ? this.isHelicopterByModel(model) : false;
    const isHelicopter =
      identifiedByIcao || identifiedByOperator || identifiedByModel;

    return {
      isHelicopter,
      identifiedByIcao,
      identifiedByOperator,
      identifiedByModel,
      model,
      operator,
      icao,
    };
  }

  /**
   * Refresh helicopter lists and return success status
   * Delegates to the underlying helicopter list service
   *
   * @param force - Force refresh even if recently refreshed
   * @returns Promise resolving to true if refresh was performed
   */
  async refreshHelicopterList(force: boolean = false): Promise<boolean> {
    try {
      return await this.helicopterListService.refreshHelicopterList(force);
    } catch (error) {
      // Error refreshing helicopter list
      return false;
    }
  }

  /**
   * Subscribe to helicopter list updates
   * Allows components to react to helicopter list changes
   */
  get helicopterListUpdated$() {
    return this.helicopterListService.helicopterListUpdated$;
  }
}
