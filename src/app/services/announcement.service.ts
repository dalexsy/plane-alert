import { Injectable } from '@angular/core';
import { TtsService } from './tts.service';
import { CountryService } from './country.service';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

export interface AnnouncementContext {
  isAirportClicked: boolean;
  clickedAirportNames?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AnnouncementService {
  constructor(
    private tts: TtsService,
    private countryService: CountryService
  ) {}

  /**
   * Handle announcements for new aircraft based on priority:
   * 1. Special models (highest priority - rare aircraft like Hercules)
   * 2. Military aircraft (medium priority)
   * 3. Airport arrivals (lowest priority)
   */
  announceNewAircraft(
    plane: PlaneLogEntry,
    context: AnnouncementContext
  ): void {
    if (!plane.isNew) {
      return;
    }

    // Special model announcements (highest priority - Hercules is rarer)
    if (this.isSpecialModel(plane)) {
      this.announceSpecialModel(plane);
    }
    // Military aircraft announcements (medium priority)
    else if (plane.isMilitary) {
      this.announceMilitaryAircraft(plane);
    }
    // Airport announcements for planes at clicked airports (lowest priority)
    else if (context.isAirportClicked) {
      this.announceAirportArrival(plane);
    }
  }

  /**
   * Announce military aircraft with operator and model information
   * Uses French locale for French military aircraft
   */
  private announceMilitaryAircraft(plane: PlaneLogEntry): void {
    let announcement = '';
    const callsign = plane.callsign?.trim();
    const model = plane.model?.trim();
    const operator = plane.operator?.trim();

    // Build announcement based on available information
    if (operator && model) {
      announcement = `${operator} ${model}`;
    } else if (operator) {
      announcement = operator;
    } else if (model) {
      // Try to determine country for fallback operator
      const origin = plane.origin;
      const countryName = origin
        ? this.countryService.getCountryName(origin)
        : null;
      if (countryName && countryName !== 'Unknown') {
        announcement = `${countryName} military ${model}`;
      } else {
        announcement = `Military ${model}`;
      }
    } else if (callsign) {
      announcement = `Military aircraft ${callsign}`;
    } else {
      announcement = 'Military aircraft';
    }

    // Detect French military aircraft and use French locale
    const isFrenchMilitary = this.isFrenchMilitaryAircraft(plane);
    const lang = isFrenchMilitary ? 'fr-FR' : navigator.language;

    // Use a unique key per plane to avoid repeating the same plane
    const ttsKey = `military-${plane.icao}`;

    this.tts.speakOnce(ttsKey, announcement, lang);
  }
  /**
   * Announce airport arrival for non-military planes
   * Uses appropriate locale based on airport location
   */
  private announceAirportArrival(plane: PlaneLogEntry): void {
    const airport = plane.airportName || 'Airport';

    // Determine locale based on airport country if available
    const lang = this.getAirportLocale(plane);

    // Preprocess text for better pronunciation
    const speakableText = this.preprocessForSpeech(airport, lang === 'de-DE');

    this.tts.speakOnce(airport, speakableText, lang);
  }

  /**
   * Announce special model aircraft (e.g., Hercules)
   * These get highest priority due to their rarity
   */
  private announceSpecialModel(plane: PlaneLogEntry): void {
    const model = plane.model?.trim();
    const callsign = plane.callsign?.trim();
    const operator = plane.operator?.trim();

    let announcement = '';

    // Build announcement based on available information
    if (operator && model) {
      announcement = `${operator} ${model}`;
    } else if (model) {
      announcement = model;
    } else if (callsign) {
      announcement = `Special aircraft ${callsign}`;
    } else {
      announcement = 'Special aircraft';
    }

    // Use a unique key per plane to avoid repeating the same plane
    const ttsKey = `special-${plane.icao}`;

    this.tts.speakOnce(ttsKey, announcement, navigator.language);
  }

  /**
   * Check if aircraft is French military based on origin country
   */
  private isFrenchMilitaryAircraft(plane: PlaneLogEntry): boolean {
    const origin = plane.origin;
    const countryName = origin
      ? this.countryService.getCountryName(origin)
      : null;

    return countryName === 'France';
  }

  /**
   * Check if aircraft is a special model that deserves custom announcement
   * Currently includes: Hercules
   */
  private isSpecialModel(plane: PlaneLogEntry): boolean {
    const model = plane.model?.toLowerCase().trim();
    if (!model) return false;

    // Check for special aircraft models
    const specialModels = ['hercules'];
    return specialModels.some((specialModel) => model.includes(specialModel));
  }
  /**
   * Preprocess text for better text-to-speech pronunciation
   * Currently handles German pronunciation fixes
   */
  private preprocessForSpeech(text: string, isGerman: boolean): string {
    if (!isGerman) return text;

    // Fix common German pronunciation issues
    // Currently no specific fixes implemented, but placeholder for future enhancements
    return text;
  }

  /**
   * Determine appropriate locale for airport announcements
   * Uses airport coordinates and country data when available
   */
  private getAirportLocale(plane: PlaneLogEntry): string {
    // If we have airport coordinates, try to determine country from location
    if (plane.airportLat != null && plane.airportLon != null) {
      // Use a more sophisticated approach to determine country from coordinates
      // For now, we'll use some basic geographic boundaries for common cases

      // Germany roughly: lat 47-55, lon 6-15
      if (
        plane.airportLat >= 47 &&
        plane.airportLat <= 55 &&
        plane.airportLon >= 6 &&
        plane.airportLon <= 15
      ) {
        return 'de-DE';
      }

      // France roughly: lat 42-51, lon -5-8
      if (
        plane.airportLat >= 42 &&
        plane.airportLat <= 51 &&
        plane.airportLon >= -5 &&
        plane.airportLon <= 8
      ) {
        return 'fr-FR';
      }

      // Spain roughly: lat 36-44, lon -10-3
      if (
        plane.airportLat >= 36 &&
        plane.airportLat <= 44 &&
        plane.airportLon >= -10 &&
        plane.airportLon <= 3
      ) {
        return 'es-ES';
      }

      // Italy roughly: lat 36-47, lon 6-19
      if (
        plane.airportLat >= 36 &&
        plane.airportLat <= 47 &&
        plane.airportLon >= 6 &&
        plane.airportLon <= 19
      ) {
        return 'it-IT';
      }

      // Netherlands roughly: lat 50-54, lon 3-7
      if (
        plane.airportLat >= 50 &&
        plane.airportLat <= 54 &&
        plane.airportLon >= 3 &&
        plane.airportLon <= 7
      ) {
        return 'nl-NL';
      }
    }

    // Fallback: if plane origin is available, use that country's locale
    if (plane.origin) {
      const countryName = this.countryService.getCountryName(plane.origin);
      switch (countryName) {
        case 'Germany':
          return 'de-DE';
        case 'France':
          return 'fr-FR';
        case 'Spain':
          return 'es-ES';
        case 'Italy':
          return 'it-IT';
        case 'Netherlands':
          return 'nl-NL';
        default:
          break;
      }
    }

    // Final fallback to browser/navigator language
    return navigator.language || 'en-US';
  }

  /**
   * Public method to check if an aircraft is a special model
   * Useful for external components that need to know about special models
   */
  public isSpecialModelPublic(plane: PlaneLogEntry): boolean {
    return this.isSpecialModel(plane);
  }

  /**
   * Public method to check if an aircraft is French military
   * Useful for external components that need to know about French military
   */
  public isFrenchMilitaryAircraftPublic(plane: PlaneLogEntry): boolean {
    return this.isFrenchMilitaryAircraft(plane);
  }
}
