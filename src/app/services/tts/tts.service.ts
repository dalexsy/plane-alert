import { Injectable } from '@angular/core';
import { isKioskMode } from '../../utils/kiosk-mode/kiosk-mode.util';
import {
  SUPPORTED_TTS_LANGUAGES,
  selectVoicesForLanguages,
} from './tts-speech.util';
import {
  armSilenceOnHide,
  armUserGestureUnlock,
  pageIsForeground,
  speakUtteranceNow,
  type TtsQueueItem,
} from './tts-lifecycle.util';

/**
 * Browser speechSynthesis requires a user gesture before autoplay.
 * Kiosk (?kiosk=1) unlocks immediately. Never speak for a background tab.
 */
@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();
  private usedVoices = new Map<string, SpeechSynthesisVoice>();
  private speechQueue: TtsQueueItem[] = [];
  private isCurrentlySpeaking = false;
  private voicesInitialized = false;
  private userUnlocked = false;

  constructor() {
    this.initializeVoices();
    if (isKioskMode()) {
      this.userUnlocked = true;
    } else {
      armUserGestureUnlock(() => {
        this.userUnlocked = true;
      });
    }
    armSilenceOnHide(() => this.cancelAll());

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (!this.voicesInitialized) this.initializeVoices();
      };
      (window as any).testTTS = () => this.test();
      (window as any).clearTTSCache = () => this.clearSpokenKeys();
      (window as any).testGermanTTS = () => this.testGerman();
      (window as any).listTTSVoices = () => this.listAvailableVoices();
    }
  }

  private initializeVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length === 0) return;
    this.usedVoices = selectVoicesForLanguages(allVoices, SUPPORTED_TTS_LANGUAGES);
    this.voicesInitialized = true;
  }

  speak(text: string, lang?: string): void {
    if (!window.speechSynthesis) return;
    this.speakImmediately(text, lang);
  }

  private speakImmediately(text: string, lang?: string): void {
    if (!window.speechSynthesis) return;
    if (isKioskMode()) return;
    if (!this.userUnlocked) return;
    if (!pageIsForeground()) {
      this.speechQueue.length = 0;
      this.isCurrentlySpeaking = false;
      return;
    }

    this.isCurrentlySpeaking = true;
    const started = speakUtteranceNow(text, lang, this.usedVoices, () => {
      this.isCurrentlySpeaking = false;
      this.processQueue();
    });
    if (!started) {
      this.isCurrentlySpeaking = false;
      this.speechQueue.length = 0;
    }
  }

  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) return;
    this.spokenKeys.add(key);
    if (!this.userUnlocked) return;
    if (!pageIsForeground()) return;
    if (this.isCurrentlySpeaking) {
      this.speechQueue.push({ key, text, lang });
    } else {
      this.speakImmediately(text, lang);
    }
  }

  private processQueue(): void {
    if (!pageIsForeground()) {
      this.speechQueue.length = 0;
      return;
    }
    if (this.speechQueue.length > 0 && !this.isCurrentlySpeaking) {
      const next = this.speechQueue.shift();
      if (next) this.speakImmediately(next.text, next.lang);
    }
  }

  test(): void {
    this.userUnlocked = true;
    this.speak('Testing text to speech', 'en-US');
  }

  clearSpokenKeys(): void {
    this.spokenKeys.clear();
    this.speechQueue.length = 0;
    this.isCurrentlySpeaking = false;
  }

  cancelAll(): void {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.speechQueue.length = 0;
    this.isCurrentlySpeaking = false;
  }

  getSpokenKeys(): string[] {
    return Array.from(this.spokenKeys);
  }

  testGerman(): void {
    this.userUnlocked = true;
    this.speak('Luftwaffe', 'de-DE');
  }

  listAvailableVoices(): void {
    const allVoices = window.speechSynthesis?.getVoices() ?? [];
    console.log('All available TTS voices:');
    allVoices.forEach((voice, index) => {
      console.log(
        `${index + 1}. ${voice.name} (${voice.lang}) - Local: ${voice.localService}`,
      );
    });
  }
}
