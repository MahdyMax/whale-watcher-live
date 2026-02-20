import { useRef, useEffect } from 'react';
import type { WhaleEvent } from './useWhaleTransactions';

// Play a short bell/chime sound using Web Audio API
function playBell() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Main bell tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    // Harmonic overtone for shimmer
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.4);
    osc2.stop(now + 0.25);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available
  }
}

export function useWhaleSound(events: WhaleEvent[], enabled: boolean = true) {
  const lastSeenRef = useRef<string | null>(null);
  const cooldownRef = useRef(0);

  useEffect(() => {
    if (!enabled || events.length === 0) return;

    const latest = events[0];
    if (!latest || latest.id === lastSeenRef.current) return;

    // Cooldown: don't spam sounds (min 300ms apart)
    const now = Date.now();
    if (now - cooldownRef.current < 300) return;

    lastSeenRef.current = latest.id;
    cooldownRef.current = now;

    playBell();
  }, [events, enabled]);
}
