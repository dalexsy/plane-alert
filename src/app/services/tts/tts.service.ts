import { Injectable } from '@angular/core';

/**
 * TTS disabled (2026-08-05) — speechSynthesis kept announcing from zombie PWAs
 * and wrong aircraft. Military alerts use MP3 only (alert-sound).
 * Methods stay as no-ops so call sites/tests do not break.
 */
@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();

  constructor() {
    this.cancelAll();
  }

  speak(_text: string, _lang?: string): void {
    this.cancelAll();
  }

  speakOnce(key: string, _text: string, _lang?: string): void {
    this.spokenKeys.add(key);
    this.cancelAll();
  }

  test(): void {
    this.cancelAll();
  }

  clearSpokenKeys(): void {
    this.spokenKeys.clear();
  }

  cancelAll(): void {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
  }

  getSpokenKeys(): string[] {
    return Array.from(this.spokenKeys);
  }

  testGerman(): void {
    this.cancelAll();
  }

  listAvailableVoices(): void {
    /* TTS removed */
  }
}
