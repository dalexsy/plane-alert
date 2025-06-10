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

  // Track all announcements to show complete output
  private currentAnnouncementParts: string[] = [];
  private currentAnnouncementKey: string = '';

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
    // DEBUG: Log the complete announcement
    console.log(`COMPLETE ANNOUNCEMENT: "${text}" (key: ${keyPrefix})`);

    // Split text by all override phrases and speak each segment in its locale or default
    const keys = Object.keys(this.overrides);
    const sorted = keys
      .sort((a, b) => b.length - a.length)
      .map((p) => p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${sorted.join('|')})`, 'gi');
    const matches = Array.from(text.matchAll(regex));

    // If any overrides found, speak counts in their locales first
    if (matches.length === 0) {
      console.log(`   Speaking entire text in ${defaultLang}: "${text}"`);
      this.tts.speakOnce(keyPrefix, text, defaultLang);
      return;
    }

    console.log(
      `   Found ${matches.length} language override(s), splitting into segments:`
    );
    let lastIndex = 0;
    let part = 0;
    for (const match of matches) {
      const idx = match.index!;
      const matchText = match[0];
      const before = text.substring(lastIndex, idx).trim();
      if (before) {
        console.log(`       Part ${part}: "${before}" (${defaultLang})`);
        this.tts.speakOnce(`${keyPrefix}-${part++}`, before, defaultLang);
      }
      // Override locale for matched phrase
      const phraseKey = keys.find(
        (k) => k.toLowerCase() === matchText.toLowerCase()
      )!;
      const locale = this.overrides[phraseKey];
      console.log(`       Part ${part}: "${matchText}" (${locale})`);
      this.tts.speakOnce(`${keyPrefix}-${part++}`, matchText, locale);
      lastIndex = idx + matchText.length;
    }
    const after = text.substring(lastIndex).trim();
    if (after) {
      console.log(`       Part ${part}: "${after}" (${defaultLang})`);
      this.tts.speakOnce(`${keyPrefix}-${part++}`, after, defaultLang);
    }
  }
}
