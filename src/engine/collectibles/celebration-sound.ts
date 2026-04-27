type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;

export function playCollectSound(): void {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) {
    console.warn('[collectibles] Web Audio API is not available');
    return;
  }

  try {
    audioContext ??= new AudioContextClass();
    void audioContext.resume().then(() => {
      if (!audioContext) return;
      playTone(audioContext, 523.25, 0);
      playTone(audioContext, 783.99, 0.15);
    }).catch((error) => {
      console.warn('[collectibles] failed to resume audio context', error);
    });
  } catch (error) {
    console.warn('[collectibles] failed to play collect sound', error);
  }
}

function getAudioContextClass(): AudioContextConstructor | null {
  const win = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return globalThis.AudioContext ?? win.webkitAudioContext ?? null;
}

function playTone(context: AudioContext, frequency: number, delay: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  const end = start + 0.22;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
  gain.gain.setValueAtTime(0.16, start + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  }, { once: true });
}
