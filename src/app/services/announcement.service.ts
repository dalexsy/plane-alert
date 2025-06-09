import { Injectable } from '@angular/core';
import { TtsService } from './tts.service';
import { CountryService } from './country.service';
import { AircraftCountryService } from './aircraft-country.service';
import { LanguageSwitchService } from './language-switch.service';
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
    private langSwitch: LanguageSwitchService
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
    const baseKey = `aircraft-${plane.icao}`;

    // Special model announcements (highest priority - Hercules is rarer)
    if (this.isSpecialModel(plane)) {
      this.announceSpecialModel(plane, baseKey);
      return; // Exit early to prevent multiple announcements
    } // Military aircraft announcements (medium priority) - queue by country to prioritize operators
    else if (plane.isMilitary) {
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
      : null; // PRIORITY 1: Detailed announcements if operator/model known (highest priority for military)
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
        this.langSwitch.speakWithOverrides(baseKey, text);
        return;
      }
    }

    // PRIORITY 3: Model only (when no operator or meaningful callsign)
    if (model) {
      // Only use special military prefixes when we actually know the operator
      // Don't assume "Luftwaffe" just because it's German military

      // Include country for first aircraft from this country
      const shouldIncludeCountry =
        originCountryName &&
        originCountryName !== 'Unknown' &&
        !this.announcedCountries.has(originCountryName);

      if (shouldIncludeCountry) {
        this.announcedCountries.add(originCountryName);
      }

      const text = shouldIncludeCountry
        ? `${originCountryName} ${model}`
        : model;
      this.langSwitch.speakWithOverrides(baseKey, text);
      return;
    } else if (plane.callsign) {
      // Announce callsign when model/operator unknown (non-meaningful callsigns)
      const callsign = plane.callsign.trim();
      let speakCallsign = this.processCallsignForSpeech(callsign);

      // Check if we've already announced this country to avoid repetition
      const shouldIncludeCountry =
        originCountryName &&
        originCountryName !== 'Unknown' &&
        !this.announcedCountries.has(originCountryName);

      if (shouldIncludeCountry) {
        this.announcedCountries.add(originCountryName);
      }

      const text = shouldIncludeCountry
        ? `${originCountryName} ${speakCallsign}`
        : speakCallsign;
      this.langSwitch.speakWithOverrides(baseKey, text);
      return;
    }
    // Fallback: aggregate unknown operator/model cases by country
    const label =
      originCountryName && originCountryName !== 'Unknown'
        ? originCountryName
        : 'Military';
    this.genericCountrySet.add(label);
    if (!this.genericAnnounceTimer) {
      this.genericAnnounceTimer = window.setTimeout(() => {
        const countries = Array.from(this.genericCountrySet);
        const list =
          countries.length === 1
            ? countries[0]
            : countries.length === 2
            ? `${countries[0]} and ${countries[1]}`
            : `${countries.slice(0, -1).join(', ')}, and ${countries.slice(
                -1
              )}`;
        this.langSwitch.speakWithOverrides(
          'military-generic',
          `${list} military`
        );
        this.genericCountrySet.clear();
        this.genericAnnounceTimer = undefined;
      }, 500);
    }
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
    }

    // PRIORITY 2: Build announcement based on available information
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

    // Use a unique key per plane to avoid repeating the same plane
    this.tts.speakOnce(baseKey, announcement, navigator.language);
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
   * Process queued military aircraft from a country, prioritizing those with operators
   */ private processMilitaryQueue(countryKey: string): void {
    const aircraft = this.militaryQueue.get(countryKey) || [];
    if (aircraft.length === 0) return;

    // Group aircraft by operator
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

    // Announce grouped operators first
    for (const [operator, planes] of operatorGroups) {
      this.announceOperatorGroup(operator, planes, countryKey);
    }

    // Then announce aircraft without operators individually (prioritizing meaningful callsigns)
    noOperator.sort((a, b) => {
      const aHasMeaningful = a.callsign
        ? this.processCallsignForSpeech(a.callsign) !== a.callsign
        : false;
      const bHasMeaningful = b.callsign
        ? this.processCallsignForSpeech(b.callsign) !== b.callsign
        : false;

      if (aHasMeaningful && !bHasMeaningful) return -1;
      if (!aHasMeaningful && bHasMeaningful) return 1;

      return 0;
    });

    noOperator.forEach((plane) => {
      const baseKey = `aircraft-${plane.icao}`;
      this.announceMilitaryAircraft(plane, baseKey);
    }); // Clean up
    this.militaryQueue.delete(countryKey);
    this.militaryQueueTimers.delete(countryKey);
  }

  /**
   * Announce a group of aircraft with the same operator in a natural way
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
      // Multiple aircraft from same operator - group them naturally
      const models = planes
        .map((plane) => plane.model?.trim())
        .filter((model) => model && model.length > 0);

      // Remove duplicates while preserving order
      const uniqueModels = [...new Set(models)];

      let announcement: string;
      if (uniqueModels.length === 0) {
        // No models known for any aircraft
        announcement = `${operator} ${planes.length} aircraft`;
      } else if (uniqueModels.length === 1 && models.length === planes.length) {
        // All aircraft have the same model specified
        if (planes.length === 2) {
          announcement = `${operator} ${planes.length} ${uniqueModels[0]}s`;
        } else {
          announcement = `${operator} ${planes.length} ${uniqueModels[0]} aircraft`;
        }
      } else {
        // Either multiple different models, or some aircraft have unknown models
        // Only announce what we know for certain
        if (models.length === 0) {
          // No models known
          announcement = `${operator} ${planes.length} aircraft`;
        } else if (models.length < planes.length) {
          // Some aircraft have unknown models - be conservative
          announcement = `${operator} ${planes.length} aircraft`;
        } else {
          // All aircraft have models, but they're different - list them naturally
          const modelList =
            uniqueModels.length === 2
              ? `${uniqueModels[0]} and ${uniqueModels[1]}`
              : `${uniqueModels
                  .slice(0, -1)
                  .join(', ')}, and ${uniqueModels.slice(-1)}`;

          announcement = `${operator} ${modelList}`;
        }
      }

      // Use the first aircraft's ICAO for the announcement key
      const baseKey = `operator-group-${operator.replace(/\s+/g, '-')}-${
        planes[0].icao
      }`;

      this.langSwitch.speakWithOverrides(baseKey, announcement);
    }
  }
}
