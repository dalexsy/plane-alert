import { Injectable } from '@angular/core';
import { TtsService } from '../tts/tts.service';
import { CountryService } from '../country/country.service';
import { AircraftCountryService } from '../aircraft-country/aircraft-country.service';
import { LanguageSwitchService } from '../language-switch/language-switch.service';
import { SettingsService } from '../settings/settings.service';
import { OperatorCallSignService } from '../operator-call-sign/operator-call-sign.service';
import type { PlaneLogEntry } from '../../types/plane-log-entry';
import {
  isSpecialModel,
  shouldAnnounceMilitary,
  processCallsignForSpeech,
  preprocessForSpeech,
  airportLocale,
} from './announcement-speech.util';
import {
  buildCountryAnnouncementText,
  buildOperatorGroupAnnouncement,
} from './announcement-build.util';

export interface AnnouncementContext {
  isAirportClicked: boolean;
  clickedAirportNames?: string[];
}

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private announcedCountries = new Set<string>();
  private announcedAircraft = new Set<string>();
  private militaryQueue = new Map<string, PlaneLogEntry[]>();
  private militaryQueueTimers = new Map<string, number>();

  constructor(
    private tts: TtsService,
    private countryService: CountryService,
    private aircraftCountryService: AircraftCountryService,
    private langSwitch: LanguageSwitchService,
    private settings: SettingsService,
    private operatorCallSignService: OperatorCallSignService
  ) {}

  announceNewAircraft(plane: PlaneLogEntry, context: AnnouncementContext): void {
    if (!plane.isNew || this.announcedAircraft.has(plane.icao)) return;
    this.announcedAircraft.add(plane.icao);
    const baseKey = `aircraft-${plane.icao}`;
    if (isSpecialModel(plane)) {
      if (plane.isMilitary && this.settings.militaryMute) return;
      this.announceSpecialModel(plane, baseKey);
    } else if (plane.isMilitary) {
      if (this.settings.militaryMute) return;
      if (!shouldAnnounceMilitary(plane)) return;
      this.queueMilitaryAircraft(plane, baseKey);
    } else if (context.isAirportClicked) {
      this.announceAirportArrival(plane, baseKey);
    }
  }

  private announceMilitaryAircraft(plane: PlaneLogEntry, baseKey: string): void {
    let operator = plane.operator?.trim();
    if (!operator && plane.callsign) {
      operator = this.operatorCallSignService.getOperatorWithLogging(plane.callsign) || undefined;
    }
    const model = plane.model?.trim();
    const originCountryName = plane.origin ? this.countryService.getCountryName(plane.origin) : null;

    if (operator && model) {
      if (originCountryName && originCountryName !== 'Unknown') this.announcedCountries.add(originCountryName);
      this.langSwitch.speakWithOverrides(baseKey, `${operator} ${model}`);
      return;
    }
    if (operator) {
      if (originCountryName && originCountryName !== 'Unknown') this.announcedCountries.add(originCountryName);
      this.langSwitch.speakWithOverrides(baseKey, operator);
      return;
    }
    if (plane.callsign) {
      const processedCallsign = processCallsignForSpeech(plane.callsign.trim());
      if (processedCallsign !== plane.callsign.trim()) {
        const text = model ? `${processedCallsign} ${model}` : processedCallsign;
        this.langSwitch.speakWithOverrides(baseKey, text);
        return;
      }
    }
    if (model) {
      const countryPrefix =
        originCountryName && originCountryName !== 'Unknown' ? `${originCountryName} military` : 'Military';
      this.langSwitch.speakWithOverrides(baseKey, `${countryPrefix} ${model}`);
      return;
    }
    if (plane.callsign) {
      const speakCallsign = processCallsignForSpeech(plane.callsign.trim());
      const countryPrefix =
        originCountryName && originCountryName !== 'Unknown' ? `${originCountryName} military` : 'Military';
      this.langSwitch.speakWithOverrides(baseKey, `${countryPrefix} ${speakCallsign}`);
      return;
    }
    const label =
      originCountryName && originCountryName !== 'Unknown' ? `${originCountryName} military` : 'Military';
    this.langSwitch.speakWithOverrides(baseKey, label);
  }

  private announceAirportArrival(plane: PlaneLogEntry, baseKey: string): void {
    const airport = plane.airportName || 'Airport';
    const lang = airportLocale(plane, this.aircraftCountryService);
    const speakableText = preprocessForSpeech(airport, lang === 'de-DE');
    this.langSwitch.speakWithOverrides(baseKey, speakableText, lang);
  }

  private announceSpecialModel(plane: PlaneLogEntry, baseKey: string): void {
    const model = plane.model?.trim();
    const callsign = plane.callsign?.trim();
    const operator = plane.operator?.trim();
    const originCountryName = plane.origin ? this.countryService.getCountryName(plane.origin) : null;

    if (callsign) {
      const processedCallsign = processCallsignForSpeech(callsign);
      if (processedCallsign !== callsign) {
        const shouldIncludeCountry =
          originCountryName && originCountryName !== 'Unknown' && !this.announcedCountries.has(originCountryName);
        if (shouldIncludeCountry) this.announcedCountries.add(originCountryName);
        const text = shouldIncludeCountry ? `${originCountryName} ${processedCallsign}` : processedCallsign;
        this.tts.speakOnce(baseKey, text, navigator.language);
        return;
      }
    }
    let announcement = '';
    if (operator && model) announcement = `${operator} ${model}`;
    else if (model) announcement = model;
    else if (callsign) announcement = `Special aircraft ${callsign}`;
    else announcement = 'Special aircraft';
    this.langSwitch.speakWithOverrides(baseKey, announcement);
  }

  private isFrenchMilitaryAircraft(plane: PlaneLogEntry): boolean {
    const origin = plane.origin;
    return (origin ? this.countryService.getCountryName(origin) : null) === 'France';
  }

  public isSpecialModelPublic(plane: PlaneLogEntry): boolean {
    return isSpecialModel(plane);
  }

  public isFrenchMilitaryAircraftPublic(plane: PlaneLogEntry): boolean {
    return this.isFrenchMilitaryAircraft(plane);
  }

  public clearAnnouncedAircraft(): void {
    this.announcedAircraft.clear();
  }

  public clearAnnouncedCountries(): void {
    this.announcedCountries.clear();
  }

  public clearMilitaryQueues(): void {
    this.militaryQueueTimers.forEach((timer) => clearTimeout(timer));
    this.militaryQueueTimers.clear();
    this.militaryQueue.clear();
  }

  private queueMilitaryAircraft(plane: PlaneLogEntry, _baseKey: string): void {
    const originCountryName = plane.origin ? this.countryService.getCountryName(plane.origin) : null;
    const countryKey = originCountryName || 'Unknown';
    if (!this.militaryQueue.has(countryKey)) this.militaryQueue.set(countryKey, []);
    this.militaryQueue.get(countryKey)!.push(plane);
    if (this.militaryQueueTimers.has(countryKey)) {
      clearTimeout(this.militaryQueueTimers.get(countryKey)!);
    }
    const timer = window.setTimeout(() => this.processMilitaryQueue(countryKey), 300);
    this.militaryQueueTimers.set(countryKey, timer);
  }

  private processMilitaryQueue(countryKey: string): void {
    const aircraft = this.militaryQueue.get(countryKey) || [];
    if (aircraft.length === 0) return;
    if (aircraft.length === 1) {
      if (countryKey !== 'Unknown') this.announcedCountries.add(countryKey);
      this.announceMilitaryAircraft(aircraft[0], `aircraft-${aircraft[0].icao}`);
      this.militaryQueue.delete(countryKey);
      this.militaryQueueTimers.delete(countryKey);
      return;
    }
    if (countryKey !== 'Unknown') this.announcedCountries.add(countryKey);
    aircraft.forEach((plane) => this.announcedAircraft.add(plane.icao));
    const announcement = buildCountryAnnouncementText(countryKey, aircraft);
    const baseKey = `country-military-${countryKey.replace(/\s+/g, '-')}-${aircraft[0].icao}`;
    this.langSwitch.speakWithOverrides(baseKey, announcement);
    this.militaryQueue.delete(countryKey);
    this.militaryQueueTimers.delete(countryKey);
  }

  private announceOperatorGroup(operator: string, planes: PlaneLogEntry[], countryKey: string): void {
    if (planes.length === 0) return;
    if (countryKey !== 'Unknown') this.announcedCountries.add(countryKey);
    planes.forEach((plane) => this.announcedAircraft.add(plane.icao));
    const announcement = buildOperatorGroupAnnouncement(operator, planes);
    const baseKey = `operator-group-${operator.replace(/\s+/g, '-')}-${planes[0].icao}`;
    this.langSwitch.speakWithOverrides(baseKey, announcement);
  }
}
