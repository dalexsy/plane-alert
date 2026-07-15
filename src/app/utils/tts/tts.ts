/**
 * Play text-to-speech. Requires a prior user gesture (browser autoplay policy).
 */
let userUnlocked = false;

function armUnlock(): void {
  if (typeof window === 'undefined' || userUnlocked) return;
  const unlock = () => {
    userUnlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

armUnlock();

export function playTTS(text: string): void {
  if (!('speechSynthesis' in window)) return;
  if (!userUnlocked) return;
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  const speak = () => {
    const voice =
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onerror = (event) => {
      if (event.error !== 'not-allowed' && event.error !== 'interrupted') {
        console.error('TTS Error:', event.error, 'for text:', text);
      }
    };
    try {
      synth.speak(utter);
    } catch {
      /* ignore */
    }
  };
  if (!voices || voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = synth.getVoices();
      speak();
    };
    synth.getVoices();
  } else {
    speak();
  }
}
