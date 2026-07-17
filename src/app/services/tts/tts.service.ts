import { Injectable } from '@angular/core';
import { isKioskMode } from '../../utils/kiosk-mode/kiosk-mode.util';
import { isPageAudible } from '../../utils/page-audible/page-audible.util';
import {
  SUPPORTED_TTS_LANGUAGES,
  preprocessTextForSpeech,
  resolveVoiceForLanguage,
  selectVoicesForLanguages,
} from './tts-speech.util';

/**
 * Browser speechSynthesis requires a user gesture before autoplay.
 * Auto-announce without gesture throws TTS Error: not-allowed (console spam).
 * Kiosk (?kiosk=1) never gets a gesture — unlock immediately there.
 * Background / hidden documents stay silent (PWA "closed" or other tab).
 */
@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();
  private usedVoices = new Map<string, SpeechSynthesisVoice>();
  private speechQueue: Array<{ key: string; text: string; lang?: string }> = [];
  private isCurrentlySpeaking = false;
  private voicesInitialized = false;
  private userUnlocked = false;

  constructor() {
    this.initializeVoices();
    if (isKioskMode()) {
      this.userUnlocked = true;
    } else {
      this.armUserGestureUnlock();
    }
    this.armVisibilitySilence();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (!this.voicesInitialized) {
          this.initializeVoices();
        }
      };
      (window as any).testTTS = () => this.test();
      (window as any).clearTTSCache = () => this.clearSpokenKeys();
      (window as any).testGermanTTS = () => this.testGerman();
      (window as any).listTTSVoices = () => this.listAvailableVoices();
    }
  }

  private armVisibilitySilence(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (!isPageAudible()) {
        this.cancelAll();
      }
    });
  }

  private armUserGestureUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.userUnlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchend', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchend', unlock, { once: true, passive: true });
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
    // Gate autoplay until a user gesture — prevents not-allowed console errors
    if (!this.userUnlocked || !isPageAudible()) {
      return;
    }

    window.speechSynthesis.cancel();
    this.isCurrentlySpeaking = true;

    setTimeout(() => {
      const processedText = preprocessTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(processedText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (lang) {
        utterance.lang = lang;
        const voice = resolveVoiceForLanguage(lang, this.usedVoices);
        if (voice) utterance.voice = voice;
      }

      utterance.onerror = (event) => {
        // not-allowed = no user gesture; interrupted = cancel — not app bugs
        if (event.error !== 'not-allowed' && event.error !== 'interrupted') {
          console.error('TTS Error:', event.error, 'for text:', text);
        }
        this.isCurrentlySpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
        this.processQueue();
      };

      try {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          setTimeout(() => window.speechSynthesis.speak(utterance), 100);
        } else {
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        this.isCurrentlySpeaking = false;
        this.processQueue();
      }
    }, 100);
  }

  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) return;
    this.spokenKeys.add(key);
    if (!this.userUnlocked || !isPageAudible()) return;
    if (this.isCurrentlySpeaking) {
      this.speechQueue.push({ key, text, lang });
    } else {
      this.speakImmediately(text, lang);
    }
  }

  private processQueue(): void {
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
