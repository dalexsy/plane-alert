import type { PlaneLogEntry } from '../../types/plane-log-entry';
import type { AircraftCountryService } from '../aircraft-country/aircraft-country.service';
import { shouldPlayMilitaryAudio } from '../../utils/boring-military/boring-military-alert.util';

const MEANINGFUL_CALLSIGN_WORDS = [
  'HERKY', 'VALOR', 'FALCON', 'EAGLE', 'HAWK', 'VIPER', 'THUNDER',
  'LIGHTNING', 'RAPTOR', 'STRIKE', 'GLOBE', 'STAR', 'SPIRIT', 'RAIDER',
  'STEEL', 'IRON', 'GOLD', 'SILVER', 'COBRA', 'PHANTOM', 'MUSTANG', 'BRONCO',
];

const LOCALE_BY_COUNTRY: Record<string, string> = {
  DE: 'de-DE',
  FR: 'fr-FR',
  ES: 'es-ES',
  IT: 'it-IT',
  NL: 'nl-NL',
};

export function isSpecialModel(plane: PlaneLogEntry): boolean {
  const model = plane.model?.toLowerCase().trim();
  if (!model) return false;
  return ['hercules', 'a400', 'a-400'].some((m) => model.includes(m));
}

/** Pushover-parity: skip TTS for boring mil unless special-listed. */
export function shouldAnnounceMilitary(plane: PlaneLogEntry): boolean {
  return shouldPlayMilitaryAudio({
    icao: plane.icao,
    callsign: plane.callsign,
    model: plane.model,
    isMilitary: plane.isMilitary === true,
    isSpecial: plane.isSpecial === true,
  });
}

export function processCallsignForSpeech(callsign: string): string {
  const match = callsign.match(/^([A-Z]+)(\d*)$/);
  if (!match) return callsign;
  const [, alphabeticPart, numericPart] = match;
  const isMeaningful = MEANINGFUL_CALLSIGN_WORDS.includes(alphabeticPart);
  let processed: string;
  if (isMeaningful || alphabeticPart.length >= 4) {
    processed = alphabeticPart.charAt(0) + alphabeticPart.slice(1).toLowerCase();
  } else {
    processed = alphabeticPart;
  }
  return processed + numericPart;
}

export function preprocessForSpeech(text: string, isGerman: boolean): string {
  return isGerman ? text : text;
}

export function localeFromCountryCode(countryCode: string): string | null {
  return LOCALE_BY_COUNTRY[countryCode.toUpperCase()] ?? null;
}

export function airportLocale(
  plane: PlaneLogEntry,
  aircraftCountry: AircraftCountryService
): string {
  if (plane.airportLat != null && plane.airportLon != null) {
    const result = aircraftCountry.getCountryFromCoordinates(
      plane.airportLat,
      plane.airportLon
    );
    if (result.countryCode !== 'Unknown') {
      const locale = localeFromCountryCode(result.countryCode);
      if (locale) return locale;
    }
  }
  if (plane.origin) {
    const locale = localeFromCountryCode(plane.origin);
    if (locale) return locale;
  }
  return navigator.language || 'en-US';
}

export function formatModelList(models: string[]): string {
  if (models.length === 0) return '';
  if (models.length === 1) return models[0];
  if (models.length === 2) return `${models[0]} and ${models[1]}`;
  return `${models.slice(0, -1).join(', ')}, and ${models[models.length - 1]}`;
}

export function numberToWord(num: number): string {
  const words = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  ];
  return num >= 0 && num <= 10 ? words[num] : String(num);
}
