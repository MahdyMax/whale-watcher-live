import { useRef, useEffect } from 'react';
import type { WhaleEvent } from './useWhaleTransactions';

// Generate a bass tone using Web Audio API
function playBassTone(volume: number, duration: number, frequency: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Sub-bass layer
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 0.5, ctx.currentTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(volume * 0.6, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);

    setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
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

    if (latest.usdValue >= 2_000_000) {
      // Mega whale: deep loud bass
      playBassTone(0.5, 0.6, 55);
    } else if (latest.usdValue >= 500_000) {
      // Whale: softer bass
      playBassTone(0.25, 0.35, 70);
    }
  }, [events, enabled]);
}
