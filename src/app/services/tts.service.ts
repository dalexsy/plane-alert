import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    // Preload voices list
    this.voices = window.speechSynthesis.getVoices();
    // Update on voiceschanged event
    window.speechSynthesis.onvoiceschanged = () => {
      this.voices = window.speechSynthesis.getVoices();
    };

    // Add TTS testing to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).testTTS = () => this.test();
      (window as any).clearTTSCache = () => this.clearSpokenKeys();
    }
  }

  /** Speak the given text via the browser's SpeechSynthesis API */
  speak(text: string, lang?: string): void {
    if (!window.speechSynthesis) {
      console.warn('TTS: SpeechSynthesis not supported in this browser.');
      return;
    }

    // Cancel any ongoing speech to prevent queue issues
    window.speechSynthesis.cancel();

    // Wait a bit for cancel to complete
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Set basic properties
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (lang) {
        utterance.lang = lang;
        // try to find exact locale match, then by language prefix
        let voice = this.voices.find((v) => v.lang === lang);
        if (!voice) {
          const code = lang.split('-')[0].toLowerCase();
          voice = this.voices.find((v) =>
            v.lang.toLowerCase().startsWith(code)
          );
        }
        if (voice) {
          utterance.voice = voice;
        }
      }

      // Add error handling
      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error, 'for text:', text);
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
  }

  /** Speak once per key */
  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) {
      return;
    }
    this.spokenKeys.add(key);
    this.speak(text, lang);
  }

  /** Test TTS functionality with a simple phrase */
  test(): void {
    console.log('Testing TTS functionality...');
    this.speak('Testing text to speech', 'en-US');
  }

  /** Clear the spoken keys cache (useful for testing) */
  clearSpokenKeys(): void {
    this.spokenKeys.clear();
    console.log('TTS Cache cleared');
  }

  /** Get current spoken keys (for debugging) */
  getSpokenKeys(): string[] {
    return Array.from(this.spokenKeys);
  }
}
