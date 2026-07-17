/**
 * True when this document may play TTS / alert MP3.
 * Hidden / background tabs and closed PWA windows must stay silent —
 * OS notifications + Pushover cover away-from-app alerts.
 */
export function isPageAudible(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.visibilityState === 'visible';
}
