import { Injectable } from '@angular/core';
import { TtsService } from './tts.service';

/**
 * Service to speak text segments with language overrides for specific words.
 * It switches to French for French terms (like "Bombardier") and German for German terms (like "Luftwaffe").
 */
@Injectable({ providedIn: 'root' })
export class LanguageSwitchService {
  // Mapping of words/phrases to specific TTS locales
  private overrides: Record<string, string> = {
    "Armée de l'Air": 'fr-FR',
    Bombardier: 'fr-FR',
    'Schweizer Luftwaffe': 'de-CH', // Swiss Air Force phrase in Swiss German
    Luftwaffe: 'de-DE',
  };

  constructor(private tts: TtsService) {}
  /**
   * Speaks the given text, switching to override locales for matched words,
   * then reverting to defaultLang for the rest.
   * @param keyPrefix Unique key for this announcement (prevents duplicate announcements)
   * @param text The full text to speak
   * @param defaultLang The default locale to use
   */
  speakWithOverrides(
    keyPrefix: string,
    text: string,
    defaultLang: string = navigator.language
  ): void {
    // Special case: if the entire text contains "Bombardier", speak it all in French
    if (text.toLowerCase().includes('bombardier')) {
      this.tts.speakOnce(keyPrefix, text, 'fr-FR');
      return;
    }

    // Special case: if the entire text contains "Luftwaffe", speak it all in German
    if (text.toLowerCase().includes('luftwaffe')) {
      // Use Swiss German for "Schweizer Luftwaffe", regular German for other Luftwaffe
      const locale = text.toLowerCase().includes('schweizer')
        ? 'de-CH'
        : 'de-DE';
      this.tts.speakOnce(keyPrefix, text, locale);
      return;
    }

    // For other cases, use default language
    this.tts.speakOnce(keyPrefix, text, defaultLang);
  }
}
