export function playAlertSound(): void {
  // Randomly choose between the two alert sounds
  const alertSounds = [
    'assets/alerts/precious_little_life_forms.mp3',
    'assets/alerts/tiny_little_life_forms.mp3',
  ];
  const randomSound =
    alertSounds[Math.floor(Math.random() * alertSounds.length)];

  playAudio(randomSound);
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

// Shared audio context and gain node to prevent multiple simultaneous plays
let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let currentAudio: HTMLAudioElement | null = null;
let lastPlayTime = 0;
const MIN_PLAY_INTERVAL = 1000; // Minimum 1 second between alert sounds

function ensureAudioGraph(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
  if (!gainNode) {
    gainNode = audioContext.createGain();
    gainNode.gain.value = 5; // Amplify beyond 100%
    gainNode.connect(audioContext.destination);
  }
  return audioContext;
}

/** Play a near-silent buffer so Chromium marks the graph as user-activated. */
function primeAudioContext(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* ignore — resume() below still helps */
  }
}

/** Call on kiosk boot so AlertContext is running before the first plane alert. */
export function unlockAlertAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = ensureAudioGraph();
    const finish = () => primeAudioContext(ctx);
    if (ctx.state === 'suspended') {
      void ctx.resume().then(finish).catch(finish);
    } else {
      finish();
    }
  } catch {
    /* autoplay still blocked until Chromium --autoplay-policy */
  }
  // Kiosk / console isolation: run testAlertSound() in Chromium console.
  (window as any).testAlertSound = () => {
    unlockAlertAudio();
    playAlertSound();
  };
}

function playAudio(soundPath: string): void {
  const now = Date.now();

  // Prevent alerts from playing too frequently
  if (now - lastPlayTime < MIN_PLAY_INTERVAL) {
    return;
  }

  // If audio is already playing, don't play another one
  if (currentAudio && !currentAudio.paused) {
    return;
  }

  lastPlayTime = now;

  try {
    const ctx = ensureAudioGraph();
    const start = () => {
      currentAudio = new Audio(soundPath);
      const source = ctx.createMediaElementSource(currentAudio);
      source.connect(gainNode!);
      const playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Audio play failed:', error);
        });
      }
      currentAudio.addEventListener('ended', () => {
        currentAudio = null;
      });
      setTimeout(() => {
        if (currentAudio && currentAudio.paused) {
          currentAudio = null;
        }
      }, 10000);
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(start).catch(start);
    } else {
      start();
    }
  } catch (error) {
    console.warn('Audio playback error:', error);
    try {
      const fallbackAudio = new Audio(soundPath);
      fallbackAudio.volume = 1;
      void fallbackAudio.play();
    } catch (fallbackError) {
      console.warn('Fallback audio playback also failed:', fallbackError);
    }
  }
}
