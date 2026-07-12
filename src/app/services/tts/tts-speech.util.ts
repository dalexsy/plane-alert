export const SUPPORTED_TTS_LANGUAGES = [
  'en-US',
  'en-GB',
  'fr-FR',
  'de-DE',
  'es-ES',
  'it-IT',
  'nl-NL',
];

export function selectVoicesForLanguages(
  allVoices: SpeechSynthesisVoice[],
  languages: readonly string[],
): Map<string, SpeechSynthesisVoice> {
  const usedVoices = new Map<string, SpeechSynthesisVoice>();

  for (const lang of languages) {
    const langPrefix = lang.split('-')[0].toLowerCase();
    const candidateVoices = allVoices.filter((v) =>
      v.lang.toLowerCase().startsWith(langPrefix),
    );

    const voice = candidateVoices.sort((a, b) => {
      const aMulti = a.name.toLowerCase().includes('multilingual');
      const bMulti = b.name.toLowerCase().includes('multilingual');
      if (aMulti && !bMulti) return 1;
      if (!aMulti && bMulti) return -1;
      if (a.lang === lang && b.lang !== lang) return -1;
      if (a.lang !== lang && b.lang === lang) return 1;
      return 0;
    })[0];

    if (voice) {
      usedVoices.set(lang, voice);
    }
  }

  return usedVoices;
}

export function preprocessTextForSpeech(text: string): string {
  let processed = text.replace(/\-/g, ' ');
  processed = processed.replace(/\b[A-Z]{4,}\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
  return processed;
}

export function resolveVoiceForLanguage(
  lang: string,
  usedVoices: Map<string, SpeechSynthesisVoice>,
): SpeechSynthesisVoice | undefined {
  let voice = usedVoices.get(lang);
  if (!voice) {
    const langPrefix = lang.split('-')[0].toLowerCase();
    voice = Array.from(usedVoices.values()).find((v) =>
      v.lang.toLowerCase().startsWith(langPrefix),
    );
  }
  return voice;
}
