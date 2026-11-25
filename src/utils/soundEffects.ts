// Local Web Audio API notification sounds (zero external CDN dependencies, 100% offline & No-VPN)

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/** Unlock Web Audio on first user interaction (required by mobile Safari/Chrome autoplay policies) */
export function unlockAudioContext(): void {
  try {
    getAudioContext();
  } catch {
    // Ignore audio context restriction errors
  }
}

/** Pleasant two-tone notification chime for Customer booking status updates */
export function playCustomerChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [880, 1174.66]; // A5 -> D6 warm spa chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
  } catch {
    // Ignore autoplay errors
  }
}

/** Multi-pulse alert chime for Admin new pending bookings */
export function playAdminAlertSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Play 3 short double-chimes over ~2.4s
    for (let burst = 0; burst < 3; burst++) {
      const base = now + burst * 0.8;
      [783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, base + idx * 0.15);

        gain.gain.setValueAtTime(0.001, base + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.22, base + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, base + idx * 0.15 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(base + idx * 0.15);
        osc.stop(base + idx * 0.15 + 0.26);
      });
    }
  } catch {
    // Ignore autoplay errors
  }
}
