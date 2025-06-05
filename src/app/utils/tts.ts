// filepath: src/app/utils/tts.ts
/**
 * Play text-to-speech using the same voice as other TTS in the app.
 * Falls back to default if not found.
 */
export function playTTS(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  let voice: SpeechSynthesisVoice | null = null;
  let voices = synth.getVoices();
  const speak = () => {
    voice =
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    synth.speak(utter);
  };
  if (!voices || voices.length === 0) {
    // Chrome/Windows bug: getVoices() may be empty until voiceschanged event
    window.speechSynthesis.onvoiceschanged = () => {
      voices = synth.getVoices();
      speak();
    };
    // Also trigger voices loading
    synth.getVoices();
  } else {
    speak();
  }
}
