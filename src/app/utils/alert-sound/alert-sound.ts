/** Plane-alert MP3 alerts — plain HTMLAudioElement (no Web Audio).
 * Web Audio + createMediaElementSource stays silent on kiosk Chromium even with
 * --autoplay-policy=no-user-gesture-required; element.play() works.
 */

import { isKioskQuietHours } from '../kiosk-quiet-hours/kiosk-quiet-hours.util';

const ALERT_SOUNDS = [
  'assets/alerts/precious_little_life_forms.mp3',
  'assets/alerts/tiny_little_life_forms.mp3',
] as const;

let currentAudio: HTMLAudioElement | null = null;
let lastPlayTime = 0;
const MIN_PLAY_INTERVAL = 1000;

function resolveAssetUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  try {
    return new URL(path, window.location.href).toString();
  } catch {
    return path;
  }
}

export function playAlertSound(): void {
  const pick = ALERT_SOUNDS[Math.floor(Math.random() * ALERT_SOUNDS.length)];
  playAudio(pick);
}

export function playHerculesAlert(): void {
  playAudio('assets/alerts/hercules.mp3');
}

export function playA400Alert(): void {
  playAudio('assets/alerts/iago.mp3');
}

export function playA380Alert(): void {
  playAudio(
    'assets/alerts/will-you-getting-soft-on-board-that-luxury-liner.mp3'
  );
}

/** Near-silent wav so Chromium media autoplay is armed before the first alert. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/** Call on kiosk boot so the first plane alert is not blocked. */
export function unlockAlertAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const primer = new Audio(SILENT_WAV);
    primer.volume = 0.01;
    void primer.play().catch(() => undefined);
  } catch {
    /* autoplay still blocked until Chromium --autoplay-policy */
  }
  // Bypass quiet hours — console isolation only.
  (window as any).testAlertSound = () => {
    unlockAlertAudio();
    playAudio(ALERT_SOUNDS[0], { force: true });
  };
}

function playAudio(
  soundPath: string,
  options: { force?: boolean } = {}
): void {
  if (!options.force && isKioskQuietHours()) return;

  const now = Date.now();
  // Rate-limit only when nothing is already playing. isNew plane alerts fire once;
  // blocking them while the session chirp (or a prior MP3) is still playing
  // permanently silences that aircraft on kiosk (phones still TTS).
  if (
    now - lastPlayTime < MIN_PLAY_INTERVAL &&
    !(currentAudio && !currentAudio.paused)
  ) {
    return;
  }
  lastPlayTime = now;

  const url = resolveAssetUrl(soundPath);
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(url);
    audio.volume = 1;
    currentAudio = audio;
    audio.addEventListener('ended', () => {
      if (currentAudio === audio) currentAudio = null;
    });
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Audio play failed:', error);
        currentAudio = null;
      });
    }
    window.setTimeout(() => {
      if (currentAudio === audio && audio.paused) currentAudio = null;
    }, 15000);
  } catch (error) {
    console.warn('Audio playback error:', error);
    currentAudio = null;
  }
}
