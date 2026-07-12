import { Injectable } from '@angular/core';
import {
  SUPPORTED_TTS_LANGUAGES,
  preprocessTextForSpeech,
  resolveVoiceForLanguage,
  selectVoicesForLanguages,
} from './tts-speech.util';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private spokenKeys = new Set<string>();
  private usedVoices = new Map<string, SpeechSynthesisVoice>();
  private speechQueue: Array<{ key: string; text: string; lang?: string }> = [];
  private isCurrentlySpeaking = false;
  private voicesInitialized = false;

  constructor() {
    this.initializeVoices();

    window.speechSynthesis.onvoiceschanged = () => {
      if (!this.voicesInitialized) {
        this.initializeVoices();
      }
    };

    if (typeof window !== 'undefined') {
      (window as any).testTTS = () => this.test();
      (window as any).clearTTSCache = () => this.clearSpokenKeys();
      (window as any).testGermanTTS = () => this.testGerman();
      (window as any).listTTSVoices = () => this.listAvailableVoices();
    }
  }

  private initializeVoices(): void {
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length === 0) return;

    this.usedVoices = selectVoicesForLanguages(
      allVoices,
      SUPPORTED_TTS_LANGUAGES
    );
    this.voicesInitialized = true;
  }

  speak(text: string, lang?: string): void {
    if (!window.speechSynthesis) {
      console.warn('TTS: SpeechSynthesis not supported in this browser.');
      return;
    }

    this.speakImmediately(text, lang);
  }

  private speakImmediately(text: string, lang?: string): void {
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
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onerror = (event) => {
        console.error('TTS Error:', event.error, 'for text:', text);
        this.isCurrentlySpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
        this.processQueue();
      };

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

  speakOnce(key: string, text: string, lang?: string): void {
    if (this.spokenKeys.has(key)) {
      return;
    }

    this.spokenKeys.add(key);
    if (this.isCurrentlySpeaking) {
      this.speechQueue.push({ key, text, lang });
    } else {
      this.speakImmediately(text, lang);
    }
  }

  private processQueue(): void {
    if (this.speechQueue.length > 0 && !this.isCurrentlySpeaking) {
      const next = this.speechQueue.shift();
      if (next) {
        this.speakImmediately(next.text, next.lang);
      }
    }
  }

  test(): void {
    this.speak('Testing text to speech', 'en-US');
  }

  clearSpokenKeys(): void {
    this.spokenKeys.clear();
    this.speechQueue.length = 0;
    this.isCurrentlySpeaking = false;
  }

  cancelAll(): void {
    window.speechSynthesis.cancel();
    this.speechQueue.length = 0;
    this.isCurrentlySpeaking = false;
  }

  getSpokenKeys(): string[] {
    return Array.from(this.spokenKeys);
  }

  testGerman(): void {
    this.speak('Luftwaffe', 'de-DE');
  }

  listAvailableVoices(): void {
    const allVoices = window.speechSynthesis.getVoices();
    console.log('All available TTS voices:');
    allVoices.forEach((voice, index) => {
      console.log(
        `${index + 1}. ${voice.name} (${voice.lang}) - Local: ${
          voice.localService
        }`
      );
    });

    console.log('\nCurrently cached voices:');
    this.usedVoices.forEach((voice, lang) => {
      console.log(`${lang}: ${voice.name} (${voice.lang})`);
    });
  }
}
