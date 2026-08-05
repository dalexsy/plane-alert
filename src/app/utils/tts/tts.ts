/**
 * TTS disabled — keep API so callers compile; never speak.
 */
export function playTTS(_text: string): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
}
