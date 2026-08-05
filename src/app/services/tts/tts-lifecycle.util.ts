import { isKioskMode } from '../../utils/kiosk-mode/kiosk-mode.util';
import {
  preprocessTextForSpeech,
  resolveVoiceForLanguage,
} from './tts-speech.util';

export type TtsQueueItem = { key: string; text: string; lang?: string };

/**
 * Speak only when this document is the focused window.
 * Installed PWAs stay "visible" on another virtual desktop / behind apps —
 * visibility alone caused ghost military TTS with no tab in Chrome's strip.
 */
export function pageIsForeground(): boolean {
  if (typeof document === 'undefined') return false;
  if (isKioskMode()) return true;
  if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') {
    return false;
  }
  if (document.hidden) return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return true;
}

export function armSilenceOnHide(cancelAll: () => void): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const silence = () => {
    if (!pageIsForeground()) cancelAll();
  };
  document.addEventListener('visibilitychange', silence);
  window.addEventListener('blur', silence);
  window.addEventListener('pagehide', cancelAll);
  window.addEventListener('beforeunload', cancelAll);
  window.addEventListener('freeze', cancelAll);
}

export function armUserGestureUnlock(onUnlock: () => void): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    onUnlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchend', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchend', unlock, { once: true, passive: true });
}

/** Speak one utterance; returns whether speech was started. */
export function speakUtteranceNow(
  text: string,
  lang: string | undefined,
  usedVoices: Map<string, SpeechSynthesisVoice>,
  onDone: () => void,
): boolean {
  if (!window.speechSynthesis) return false;
  if (isKioskMode()) return false;
  if (!pageIsForeground()) return false;

  window.speechSynthesis.cancel();

  setTimeout(() => {
    if (!pageIsForeground()) {
      onDone();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(preprocessTextForSpeech(text));
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (lang) {
      utterance.lang = lang;
      const voice = resolveVoiceForLanguage(lang, usedVoices);
      if (voice) utterance.voice = voice;
    }

    utterance.onerror = (event) => {
      if (event.error !== 'not-allowed' && event.error !== 'interrupted') {
        console.error('TTS Error:', event.error, 'for text:', text);
      }
      onDone();
    };
    utterance.onend = () => onDone();

    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setTimeout(() => window.speechSynthesis.speak(utterance), 100);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      onDone();
    }
  }, 100);

  return true;
}
