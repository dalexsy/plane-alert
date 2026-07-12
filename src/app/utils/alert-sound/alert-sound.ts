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
    // Create or reuse audio context
    if (!audioContext) {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    // Resume context if suspended (required by some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create or reuse gain node
    if (!gainNode) {
      gainNode = audioContext.createGain();
      gainNode.gain.value = 5; // Amplify beyond 100%
      gainNode.connect(audioContext.destination);
    }

    // Create new audio element
    currentAudio = new Audio(soundPath);
    const source = audioContext.createMediaElementSource(currentAudio);

    // Disconnect previous source if it exists
    if (source) {
      source.connect(gainNode);
    }

    // Play the audio
    const playPromise = currentAudio.play();

    // Handle play promise (required for some browsers)
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Audio started playing
        })
        .catch((error) => {
          console.warn('Audio play failed:', error);
        });
    }

    // Clean up when audio ends
    currentAudio.addEventListener('ended', () => {
      currentAudio = null;
    });

    // Fallback cleanup after 10 seconds (in case ended event doesn't fire)
    setTimeout(() => {
      if (currentAudio && currentAudio.paused) {
        currentAudio = null;
      }
    }, 10000);
  } catch (error) {
    console.warn('Audio playback error:', error);
    // Fallback to simple audio play without Web Audio API
    try {
      const fallbackAudio = new Audio(soundPath);
      fallbackAudio.volume = 5; // Try to amplify (though browser may limit to 1.0)
      fallbackAudio.play();
    } catch (fallbackError) {
      console.warn('Fallback audio playback also failed:', fallbackError);
    }
  }
}
