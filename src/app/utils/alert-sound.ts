export function playAlertSound(): void {
  // Randomly choose between the two alert sounds
  const alertSounds = [
    'assets/alerts/precious_little_life_forms.mp3',
    'assets/alerts/tiny_little_life_forms.mp3',
  ];
  const randomSound =
    alertSounds[Math.floor(Math.random() * alertSounds.length)];

  // Use Web Audio API for volume amplification beyond 100%
  const audioCtx = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  const audio = new Audio(randomSound);
  const source = audioCtx.createMediaElementSource(audio);
  const gainNode = audioCtx.createGain();

  // Amplify beyond 100% - adjust this value as needed (2.0 = 200% volume)
  gainNode.gain.value = 5;

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  audio.play();
}

export function playHerculesAlert(): void {
  const audio = new Audio('assets/alerts/hercules.mp3');
  audio.play();
}
