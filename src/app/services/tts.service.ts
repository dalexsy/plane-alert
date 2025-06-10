import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();
  private usedVoices = new Map<string, SpeechSynthesisVoice>(); // Cache only the voices we use
  private speechQueue: Array<{ key: string; text: string; lang?: string }> = [];
  private isCurrentlySpeaking = false;
  private voicesInitialized = false;

  // Languages actually used by the application
  private readonly SUPPORTED_LANGUAGES = [
    'en-US',
    'en-GB', // English variants
    'fr-FR', // French for Bombardier
    'de-DE', // German for Luftwaffe
    'es-ES', // Spanish
    'it-IT', // Italian
    'nl-NL', // Dutch
  ];

  constructor() {
    this.initializeVoices();

    // Update when voices become available
    window.speechSynthesis.onvoiceschanged = () => {
      if (!this.voicesInitialized) {
        this.initializeVoices();
      }
    };

    // Add TTS testing to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).testTTS = () => this.test();
      (window as any).clearTTSCache = () => this.clearSpokenKeys();
    }
  }
  /**
   * Initialize only the voices we actually need
   */
  private initializeVoices(): void {
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length === 0) return;

    let foundVoices = 0;

    // Find and cache only the voices for languages we support
    for (const lang of this.SUPPORTED_LANGUAGES) {
      // Prefer non-multilingual voices for better accent
      const langPrefix = lang.split('-')[0].toLowerCase();
      const candidateVoices = allVoices.filter((v) =>
        v.lang.toLowerCase().startsWith(langPrefix)
      );

      // Sort: prefer non-multilingual, then exact match, then any match
      const voice = candidateVoices.sort((a, b) => {
        const aMulti = a.name.toLowerCase().includes('multilingual');
        const bMulti = b.name.toLowerCase().includes('multilingual');
        if (aMulti && !bMulti) return 1;
        if (!aMulti && bMulti) return -1;
        if (a.lang === lang && b.lang !== lang) return -1;
        if (a.lang !== lang && b.lang === lang) return 1;
        return 0;
      })[0];

      if (voice) {
        this.usedVoices.set(lang, voice);
        foundVoices++;
      }
    }
  }
  /** Speak the given text via the browser's SpeechSynthesis API with queueing */
  speak(text: string, lang?: string): void {
    if (!window.speechSynthesis) {
      console.warn('TTS: SpeechSynthesis not supported in this browser.');
      return;
    }

    this.speakImmediately(text, lang);
  } /** Speak immediately without queueing (for urgent announcements) */
  private speakImmediately(text: string, lang?: string): void {
    // Cancel any ongoing speech to prevent queue issues
    window.speechSynthesis.cancel();
    this.isCurrentlySpeaking = true;

    // Wait a bit for cancel to complete
    setTimeout(() => {
      // Preprocess text for better pronunciation
      const processedText = this.preprocessTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(processedText);

      // Set basic properties
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (lang) {
        utterance.lang = lang;

        // Use our cached voice for this language
        let voice = this.usedVoices.get(lang);
        if (!voice) {
          // Fallback: try language prefix (e.g., 'de' for 'de-DE')
          const langPrefix = lang.split('-')[0].toLowerCase();
          voice = Array.from(this.usedVoices.values()).find((v) =>
            v.lang.toLowerCase().startsWith(langPrefix)
          );
        }
        if (voice) {
          utterance.voice = voice;
        }
      }

      // Add error handling and completion tracking
      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error, 'for text:', text);

        this.isCurrentlySpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
        this.processQueue();
      };

      // Check if speech synthesis is ready
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 100);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    }, 100);
  } /** Speak once per key with intelligent queueing */
  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) {
      return;
    }

    this.spokenKeys.add(key); // Add to queue if currently speaking, otherwise speak immediately
    if (this.isCurrentlySpeaking) {
      this.speechQueue.push({ key, text, lang });
    } else {
      this.speakImmediately(text, lang);
    }
  }
  /** Process the next item in the speech queue */
  private processQueue(): void {
    if (this.speechQueue.length > 0 && !this.isCurrentlySpeaking) {
      const next = this.speechQueue.shift();
      if (next) {
        this.speakImmediately(next.text, next.lang);
      }
    }
  }
  /** Test TTS functionality with a simple phrase */
  test(): void {
    this.speak('Testing text to speech', 'en-US');
  } /** Clear the spoken keys cache (useful for testing) */
  clearSpokenKeys(): void {
    this.spokenKeys.clear();
    this.speechQueue.length = 0; // Clear the queue too
    this.isCurrentlySpeaking = false;
  }
  /** Get current spoken keys (for debugging) */
  getSpokenKeys(): string[] {
    return Array.from(this.spokenKeys);
  }

  /** Preprocess text for better TTS pronunciation */
  private preprocessTextForSpeech(text: string): string {
    let processed = text;

    // Replace minus with dash for better pronunciation
    processed = processed.replace(/\-/g, ' ');

    // Improve callsign pronunciation - look for meaningful words
    processed = this.improveCallsignPronunciation(processed);

    return processed;
  }
  /** Improve pronunciation of callsigns by detecting meaningful words */
  private improveCallsignPronunciation(text: string): string {
    // Convert long uppercase letter sequences to word pronunciation
    // This handles callsigns like HERKY03 -> Herky03, VALOR21 -> Valor21
    return text.replace(/\b[A-Z]{4,}\b/g, (match) => {
      // Convert to Title Case (first letter uppercase, rest lowercase)
      return match.charAt(0) + match.slice(1).toLowerCase();
    });
  }
}
