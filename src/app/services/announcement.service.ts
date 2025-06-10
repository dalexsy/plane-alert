import { Injectable } from '@angular/core';
import { TtsService } from './tts.service';
import { CountryService } from './country.service';
import { AircraftCountryService } from './aircraft-country.service';
import { LanguageSwitchService } from './language-switch.service';
import { SettingsService } from './settings.service';
import { PlaneLogEntry } from '../components/results-overlay/results-overlay.component';

export interface AnnouncementContext {
  isAirportClicked: boolean;
  clickedAirportNames?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AnnouncementService {
  // Collect generic country-only military announcements
  private genericCountrySet = new Set<string>();
  private genericAnnounceTimer?: number;
  // Track countries that have already been announced to avoid repetition
  private announcedCountries = new Set<string>();
  // Track aircraft that have already been announced to prevent duplicates
  private announcedAircraft = new Set<string>();
  // Queue military aircraft briefly to prioritize those with operators
  private militaryQueue = new Map<string, PlaneLogEntry[]>();
  private militaryQueueTimers = new Map<string, number>();
  constructor(
    private tts: TtsService,
    private countryService: CountryService,
    private aircraftCountryService: AircraftCountryService,
    private langSwitch: LanguageSwitchService,
    private settings: SettingsService
  ) {}
  /**
   * Handle announcements for new aircraft based on priority:
   * 1. Special models (highest priority - rare aircraft like Hercules)
   * 2. Military aircraft (medium priority)
   * 3. Airport arrivals (lowest priority)
   *
   * CRITICAL: Each aircraft gets exactly ONE announcement to prevent TTS chaos
   */ announceNewAircraft(
    plane: PlaneLogEntry,
    context: AnnouncementContext
  ): void {
    if (!plane.isNew) {
      return;
    }

    // Prevent duplicate announcements of the same aircraft
    if (this.announcedAircraft.has(plane.icao)) {
      return;
    }

    // Mark this aircraft as announced
    this.announcedAircraft.add(plane.icao);

    // Use a single TTS key per aircraft to prevent overlapping announcements
    const baseKey = `aircraft-${plane.icao}`; // Special model announcements (highest priority - Hercules is rarer)
    if (this.isSpecialModel(plane)) {
      // Check if military mute is enabled for special military aircraft
      if (plane.isMilitary && this.settings.militaryMute) {
        return; // Skip announcement if military mute is enabled
      }
      this.announceSpecialModel(plane, baseKey);
      return; // Exit early to prevent multiple announcements
    } // Military aircraft announcements (medium priority) - queue by country to prioritize operators
    else if (plane.isMilitary) {
      // Check if military mute is enabled
      if (this.settings.militaryMute) {
        return; // Skip announcement if military mute is enabled
      }
      this.queueMilitaryAircraft(plane, baseKey);
      return; // Exit early to prevent multiple announcements
    }
    // Airport announcements for planes at clicked airports (lowest priority)
    else if (context.isAirportClicked) {
      this.announceAirportArrival(plane, baseKey);
      return; // Exit early to prevent multiple announcements
    }
  }
  /**
   * Announce military aircraft with operator and model information
   * Uses French locale for French military aircraft
   * @param plane The aircraft to announce
   * @param baseKey The base TTS key to prevent overlapping announcements
   */ private announceMilitaryAircraft(
    plane: PlaneLogEntry,
    baseKey: string
  ): void {
    const operator = plane.operator?.trim();
    const model = plane.model?.trim();
    const originCountryName = plane.origin
      ? this.countryService.getCountryName(plane.origin)
      : null;

    // PRIORITY 1: Detailed announcements if operator/model known (highest priority for military)
    if (operator && model) {
      // If we have operator, just use operator + model (no country needed)
      // Mark this country as announced to prevent repetition
      if (originCountryName && originCountryName !== 'Unknown') {
        this.announcedCountries.add(originCountryName);
      }
      const text = `${operator} ${model}`;
      this.langSwitch.speakWithOverrides(baseKey, text);
      return;
    } else if (operator) {
      // If we have operator, just use operator (no country needed)
      // Mark this country as announced to prevent repetition
      if (originCountryName && originCountryName !== 'Unknown') {
        this.announcedCountries.add(originCountryName);
      }
      this.langSwitch.speakWithOverrides(baseKey, operator);
      return;
    }

    // PRIORITY 2: Check for meaningful callsign (fallback when no operator)
    if (plane.callsign) {
      const callsign = plane.callsign.trim();
      const processedCallsign = this.processCallsignForSpeech(callsign);
      // If the callsign was processed (meaningful word detected), prioritize it over everything
      if (processedCallsign !== callsign) {
        // Combine callsign and model if model exists
        let announcementText = processedCallsign;
        if (model) {
          announcementText = `${processedCallsign} ${model}`;
        }
        // Speak callsign and model without country prefix
        this.langSwitch.speakWithOverrides(baseKey, announcementText);
        return;
      }
    } // PRIORITY 3: Model only (when no operator or meaningful callsign)
    if (model) {
      // No operator - announce country + military + model
      const countryPrefix =
        originCountryName && originCountryName !== 'Unknown'
          ? `${originCountryName} military`
          : 'Military';
      const text = `${countryPrefix} ${model}`;
      this.langSwitch.speakWithOverrides(baseKey, text);
      return;
    } else if (plane.callsign) {
      // Announce callsign when model/operator unknown (non-meaningful callsigns)
      const callsign = plane.callsign.trim();
      let speakCallsign = this.processCallsignForSpeech(callsign);

      // No operator - announce country + military + callsign
      const countryPrefix =
        originCountryName && originCountryName !== 'Unknown'
          ? `${originCountryName} military`
          : 'Military';
      const text = `${countryPrefix} ${speakCallsign}`;
      this.langSwitch.speakWithOverrides(baseKey, text);
      return;
    }

    // Fallback: announce country + military
    const label =
      originCountryName && originCountryName !== 'Unknown'
        ? `${originCountryName} military`
        : 'Military';
    this.langSwitch.speakWithOverrides(baseKey, label);
  }

  /**
   * Announce airport arrival for non-military planes
   * Uses appropriate locale based on airport location
   * @param plane The aircraft to announce
   * @param baseKey The base TTS key to prevent overlapping announcements
   */
  private announceAirportArrival(plane: PlaneLogEntry, baseKey: string): void {
    const airport = plane.airportName || 'Airport';

    // Determine locale based on airport country if available
    const lang = this.getAirportLocale(plane); // Preprocess text for better pronunciation
    const speakableText = this.preprocessForSpeech(airport, lang === 'de-DE');

    const ttsKey = baseKey;
    this.langSwitch.speakWithOverrides(ttsKey, speakableText);
  }
  /**
   * Announce special model aircraft (e.g., Hercules)
   * These get highest priority due to their rarity
   * @param plane The aircraft to announce
   * @param baseKey The base TTS key to prevent overlapping announcements
   */
  private announceSpecialModel(plane: PlaneLogEntry, baseKey: string): void {
    const model = plane.model?.trim();
    const callsign = plane.callsign?.trim();
    const operator = plane.operator?.trim();
    const originCountryName = plane.origin
      ? this.countryService.getCountryName(plane.origin)
      : null; // PRIORITY 1: Check for meaningful callsign first (even for special models)
    if (callsign) {
      const processedCallsign = this.processCallsignForSpeech(callsign);

      // If the callsign was processed (meaningful word detected), prioritize it
      if (processedCallsign !== callsign) {
        // Check if we've already announced this country to avoid repetition
        const shouldIncludeCountry =
          originCountryName &&
          originCountryName !== 'Unknown' &&
          !this.announcedCountries.has(originCountryName);

        if (shouldIncludeCountry) {
          this.announcedCountries.add(originCountryName);
        }
        const text = shouldIncludeCountry
          ? `${originCountryName} ${processedCallsign}`
          : processedCallsign;
        this.tts.speakOnce(baseKey, text, navigator.language);
        return;
      }
    } // PRIORITY 2: Build announcement based on available information
    let announcement = '';
    if (operator && model) {
      announcement = `${operator} ${model}`;
    } else if (model) {
      announcement = model;
    } else if (callsign) {
      announcement = `Special aircraft ${callsign}`;
    } else {
      announcement = 'Special aircraft';
    }

    // Use language switching for special aircraft announcements to handle terms like "Luftwaffe"
    this.langSwitch.speakWithOverrides(baseKey, announcement);
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
   * Currently includes: Hercules, A400
   */
  private isSpecialModel(plane: PlaneLogEntry): boolean {
    const model = plane.model?.toLowerCase().trim();
    if (!model) return false;

    // Check for special aircraft models
    const specialModels = ['hercules', 'a400'];
    return specialModels.some((specialModel) => model.includes(specialModel));
  }

  /**
   * Process callsign for better speech pronunciation
   * Handles meaningful aviation words and standard formatting
   */
  private processCallsignForSpeech(callsign: string): string {
    // Extract the alphabetic part and numeric part
    const match = callsign.match(/^([A-Z]+)(\d*)$/);
    if (!match) return callsign;

    const [, alphabeticPart, numericPart] = match;

    // List of meaningful aviation words that should be pronounced as words
    const meaningfulWords = [
      'HERKY',
      'VALOR',
      'FALCON',
      'EAGLE',
      'HAWK',
      'VIPER',
      'THUNDER',
      'LIGHTNING',
      'RAPTOR',
      'STRIKE',
      'GLOBE',
      'STAR',
      'SPIRIT',
      'RAIDER',
      'STEEL',
      'IRON',
      'GOLD',
      'SILVER',
      'COBRA',
      'PHANTOM',
      'MUSTANG',
      'BRONCO',
    ];

    // Check if the alphabetic part is a meaningful word
    const isMeaningful = meaningfulWords.includes(alphabeticPart);

    let processedAlphabetic;
    if (isMeaningful) {
      // Pronounce as a word (capitalize first letter, rest lowercase)
      processedAlphabetic =
        alphabeticPart.charAt(0) + alphabeticPart.slice(1).toLowerCase();
    } else if (alphabeticPart.length >= 4) {
      // For 4+ letter callsigns that aren't meaningful, still try as word
      processedAlphabetic =
        alphabeticPart.charAt(0) + alphabeticPart.slice(1).toLowerCase();
    } else {
      // Short callsigns (3 or fewer letters) - keep as is for spelling
      processedAlphabetic = alphabeticPart;
    }

    return processedAlphabetic + numericPart;
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
    // If we have airport coordinates, use the AircraftCountryService to determine country
    if (plane.airportLat != null && plane.airportLon != null) {
      const countryResult =
        this.aircraftCountryService.getCountryFromCoordinates(
          plane.airportLat,
          plane.airportLon
        );

      if (countryResult.countryCode !== 'Unknown') {
        const locale = this.getLocaleFromCountryCode(countryResult.countryCode);
        if (locale) {
          return locale;
        }
      }
    } // Fallback: if plane origin is available, use that country's locale
    if (plane.origin) {
      const locale = this.getLocaleFromCountryCode(plane.origin);
      if (locale) {
        return locale;
      }
    }

    // Final fallback to browser/navigator language
    return navigator.language || 'en-US';
  }

  /**
   * Maps country codes to locale strings for announcement purposes
   * @param countryCode ISO 3166-1 alpha-2 country code
   * @returns Locale string (e.g., 'de-DE', 'fr-FR') or null if not supported
   */
  private getLocaleFromCountryCode(countryCode: string): string | null {
    const localeMap: { [key: string]: string } = {
      DE: 'de-DE',
      FR: 'fr-FR',
      ES: 'es-ES',
      IT: 'it-IT',
      NL: 'nl-NL',
    };

    return localeMap[countryCode.toUpperCase()] || null;
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

  /**
   * Clear announced aircraft cache - useful for testing or long-running sessions
   */
  public clearAnnouncedAircraft(): void {
    this.announcedAircraft.clear();
  }

  /**
   * Clear announced countries cache - useful for testing or long-running sessions
   */
  public clearAnnouncedCountries(): void {
    this.announcedCountries.clear();
  }

  /**
   * Clear military aircraft queues - useful for testing or long-running sessions
   */
  public clearMilitaryQueues(): void {
    // Clear all timers
    this.militaryQueueTimers.forEach((timer) => clearTimeout(timer));
    this.militaryQueueTimers.clear();
    this.militaryQueue.clear();
  }
  /**
   * Queue military aircraft by country to prioritize those with operators
   * This prevents "Switzerland Surfr12" from being announced when "Schweizer Luftwaffe" exists
   */
  private queueMilitaryAircraft(plane: PlaneLogEntry, baseKey: string): void {
    const originCountryName = plane.origin
      ? this.countryService.getCountryName(plane.origin)
      : null;
    const countryKey = originCountryName || 'Unknown';

    // Add to queue for this country
    if (!this.militaryQueue.has(countryKey)) {
      this.militaryQueue.set(countryKey, []);
    }
    this.militaryQueue.get(countryKey)!.push(plane);

    // Clear existing timer for this country and set a new one
    if (this.militaryQueueTimers.has(countryKey)) {
      clearTimeout(this.militaryQueueTimers.get(countryKey)!);
    }

    const timer = window.setTimeout(() => {
      this.processMilitaryQueue(countryKey);
    }, 300); // 300ms delay to collect aircraft from same country

    this.militaryQueueTimers.set(countryKey, timer);
  }
  /**
   * Process queued military aircraft from a country, creating one natural announcement per country
   */ private processMilitaryQueue(countryKey: string): void {
    const aircraft = this.militaryQueue.get(countryKey) || [];
    if (aircraft.length === 0) return;

    // Handle single military aircraft immediately with detailed announcement
    if (aircraft.length === 1) {
      const plane = aircraft[0];
      // Mark country as announced to prevent repetition
      if (countryKey !== 'Unknown') {
        this.announcedCountries.add(countryKey);
      }
      // Use detailed announcement for single military aircraft
      this.announceMilitaryAircraft(plane, `aircraft-${plane.icao}`);
      // Clean up queue and timers
      this.militaryQueue.delete(countryKey);
      this.militaryQueueTimers.delete(countryKey);
      return;
    }

    // Mark country as announced to prevent repetition
    if (countryKey !== 'Unknown') {
      this.announcedCountries.add(countryKey);
    }

    // Mark all aircraft as announced
    aircraft.forEach((plane) => {
      this.announcedAircraft.add(plane.icao);
    });

    // Create one natural announcement for the entire country
    const announcement = this.buildCountryAnnouncement(countryKey, aircraft);
    const baseKey = `country-military-${countryKey.replace(/\s+/g, '-')}-${
      aircraft[0].icao
    }`;

    this.langSwitch.speakWithOverrides(baseKey, announcement);

    // Clean up
    this.militaryQueue.delete(countryKey);
    this.militaryQueueTimers.delete(countryKey);
  }
  /**
   * Announce a group of aircraft with the same operator in a natural way
   * Says the operator once followed by all aircraft models with proper grammar
   */
  private announceOperatorGroup(
    operator: string,
    planes: PlaneLogEntry[],
    countryKey: string
  ): void {
    if (planes.length === 0) return;

    // Mark country as announced to prevent repetition
    if (countryKey !== 'Unknown') {
      this.announcedCountries.add(countryKey);
    }

    // Mark all aircraft as announced
    planes.forEach((plane) => {
      this.announcedAircraft.add(plane.icao);
    });

    if (planes.length === 1) {
      // Single aircraft - use existing logic
      const plane = planes[0];
      const baseKey = `aircraft-${plane.icao}`;
      const model = plane.model?.trim();

      if (model) {
        const text = `${operator} ${model}`;
        this.langSwitch.speakWithOverrides(baseKey, text);
      } else {
        this.langSwitch.speakWithOverrides(baseKey, operator);
      }
    } else {
      // Multiple aircraft from same operator - say operator once, then list models
      const models = planes
        .map((plane) => plane.model?.trim())
        .filter(
          (model): model is string => model !== undefined && model.length > 0
        );

      // Remove duplicates while preserving order
      const uniqueModels = [...new Set(models)];
      let announcement: string;
      if (uniqueModels.length === 0) {
        // No models known for any aircraft
        announcement = `${operator}, ${planes.length} aircraft`;
      } else if (uniqueModels.length === 1) {
        // Only one model type known
        const modelCount = models.filter((m) => m === uniqueModels[0]).length;
        if (modelCount === planes.length && planes.length === 2) {
          // Two aircraft of the same model - say "Luftwaffe, two F-16s"
          announcement = `${operator}, two ${uniqueModels[0]}s`;
        } else if (modelCount === planes.length && planes.length > 2) {
          // Multiple aircraft of the same model - say "Luftwaffe, three F-16s"
          const countWord = this.numberToWord(planes.length);
          announcement = `${operator}, ${countWord} ${uniqueModels[0]}s`;
        } else if (modelCount < planes.length) {
          // Some aircraft have unknown models - say "Luftwaffe, F-16 and others"
          const unknownCount = planes.length - modelCount;
          if (unknownCount === 1) {
            announcement = `${operator}, ${uniqueModels[0]} and one other`;
          } else {
            announcement = `${operator}, ${uniqueModels[0]} and ${unknownCount} others`;
          }
        } else {
          // Just announce the known model
          announcement = `${operator}, ${uniqueModels[0]}`;
        }
      } else {
        // Multiple different models - list them naturally after the operator
        const modelList = this.formatModelList(uniqueModels);
        announcement = `${operator}, ${modelList}`;
      }

      // Use the first aircraft's ICAO for the announcement key
      const baseKey = `operator-group-${operator.replace(/\s+/g, '-')}-${
        planes[0].icao
      }`;

      this.langSwitch.speakWithOverrides(baseKey, announcement);
    }
  }

  /**
   * Format a list of aircraft models with proper grammar
   * Examples: "F-16", "F-16 and F-18", "F-16, F-18, and C-130"
   */
  private formatModelList(models: string[]): string {
    if (models.length === 1) {
      return models[0];
    } else if (models.length === 2) {
      return `${models[0]} and ${models[1]}`;
    } else {
      return `${models.slice(0, -1).join(', ')}, and ${
        models[models.length - 1]
      }`;
    }
  }

  /**
   * Convert numbers to words for natural announcements
   * Examples: 2 -> "two", 3 -> "three", etc.
   */
  private numberToWord(num: number): string {
    const words = [
      '',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
    ];
    return words[num] || num.toString();
  }

  /**
   * Build a natural announcement for all military aircraft from a country
   * Examples: "German military", "Luftwaffe", "Luftwaffe Eurofighter and transport"
   */
  private buildCountryAnnouncement(
    countryKey: string,
    aircraft: PlaneLogEntry[]
  ): string {
    if (aircraft.length === 0) return `${countryKey} military`;

    // Group by operator
    const operatorGroups = new Map<string, PlaneLogEntry[]>();
    const noOperator: PlaneLogEntry[] = [];

    aircraft.forEach((plane) => {
      const operator = plane.operator?.trim();
      if (operator) {
        if (!operatorGroups.has(operator)) {
          operatorGroups.set(operator, []);
        }
        operatorGroups.get(operator)!.push(plane);
      } else {
        noOperator.push(plane);
      }
    });

    // If only one operator and it covers most aircraft, use that operator
    if (operatorGroups.size === 1 && noOperator.length === 0) {
      const [operator, planes] = Array.from(operatorGroups.entries())[0];
      return this.buildOperatorAnnouncement(operator, planes);
    }

    // If multiple operators but one dominant operator, use that
    if (operatorGroups.size > 0) {
      const largestGroup = Array.from(operatorGroups.entries()).sort(
        ([, a], [, b]) => b.length - a.length
      )[0];

      if (largestGroup[1].length >= aircraft.length * 0.7) {
        // If one operator has 70%+ of aircraft, just announce that operator
        return this.buildOperatorAnnouncement(largestGroup[0], largestGroup[1]);
      }
    }

    // Fallback: use country name
    if (aircraft.length === 1) {
      return `${countryKey} military`;
    } else {
      return `${countryKey} military, ${aircraft.length} aircraft`;
    }
  }

  /**
   * Build announcement for a specific operator and their aircraft
   * Examples: "Luftwaffe", "Luftwaffe Eurofighter", "Luftwaffe, two aircraft"
   */
  private buildOperatorAnnouncement(
    operator: string,
    aircraft: PlaneLogEntry[]
  ): string {
    if (aircraft.length === 1) {
      const model = aircraft[0].model?.trim();
      return model ? `${operator} ${model}` : operator;
    }

    // Multiple aircraft - get models
    const models = aircraft
      .map((plane) => plane.model?.trim())
      .filter(
        (model): model is string => model !== undefined && model.length > 0
      );

    const uniqueModels = [...new Set(models)];

    if (uniqueModels.length === 0) {
      // No models known
      return aircraft.length === 2
        ? `${operator}, two aircraft`
        : `${operator}, ${aircraft.length} aircraft`;
    } else if (uniqueModels.length === 1) {
      // All same model or only one model known
      if (models.length === aircraft.length && aircraft.length === 2) {
        return `${operator}, two ${uniqueModels[0]}s`;
      } else if (models.length === aircraft.length) {
        const countWord = this.numberToWord(aircraft.length);
        return `${operator}, ${countWord} ${uniqueModels[0]}s`;
      } else {
        return `${operator} ${uniqueModels[0]}`;
      }
    } else {
      // Multiple different models - list them
      const modelList = this.formatModelList(uniqueModels);
      return `${operator} ${modelList}`;
    }
  }
}
