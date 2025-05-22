export function playAlertSound(): void {
  const shiftSemitones = Math.floor(Math.random() * 7) - 3;
  const multiplier = Math.pow(3, shiftSemitones / 12);
  const audioCtx = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  const now = audioCtx.currentTime;
  const sequence = [
    { freq: 261.63, duration: 0.3 },
    { freq: 261.63, duration: 0.3 },
    { freq: 261.63, duration: 0.3 },
    { freq: 261.63, duration: 0.3 },
    { freq: 261.63, duration: 0.3 },
    { freq: 783.99, duration: 1.0 },
    { freq: 880, duration: 1.0 },
  ];

  const pauseDuration = 0.1;
  let time = now;
  sequence.forEach((note) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = note.freq * multiplier;
    gain.gain.setValueAtTime(0.1, time);
    osc.start(time);
    osc.stop(time + note.duration);
    time += note.duration + pauseDuration;
  });
}

export function playHerculesAlert(): void {
  const audio = new Audio('assets/alerts/hercules.mp3');
  audio.play();
}
