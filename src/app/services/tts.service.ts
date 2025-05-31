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
  }

  /** Speak the given text via the browser's SpeechSynthesis API */
  speak(text: string, lang?: string): void {
    if (!window.speechSynthesis) {
      console.warn('SpeechSynthesis not supported in this browser.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) {
      utterance.lang = lang;
      // try to find exact locale match, then by language prefix
      let voice = this.voices.find(v => v.lang === lang);
      if (!voice) {
        const code = lang.split('-')[0].toLowerCase();
        voice = this.voices.find(v => v.lang.toLowerCase().startsWith(code));
      }
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  }

  /** Speak once per key */
  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) return;
    this.spokenKeys.add(key);
    this.speak(text, lang);
  }
}
