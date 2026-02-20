import { useRef, useEffect } from 'react';
import type { WhaleEvent } from './useWhaleTransactions';

// Play a Spotify-style notification "du-dun" using Web Audio API
function playNotification() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Note 1 – warm rising tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587, now);        // D5
    osc1.frequency.setValueAtTime(784, now + 0.12); // G5

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.25, now);
    g1.gain.setValueAtTime(0.25, now + 0.1);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    // Note 2 – brighter resolve
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(988, now + 0.13); // B5

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.setValueAtTime(0.22, now + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    // Soft harmonic shimmer on note 2
    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1976, now + 0.13); // B6 octave

    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0, now);
    g3.gain.setValueAtTime(0.06, now + 0.13);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(g1).connect(ctx.destination);
    osc2.connect(g2).connect(ctx.destination);
    osc3.connect(g3).connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);
    osc2.start(now + 0.13);
    osc2.stop(now + 0.38);
    osc3.start(now + 0.13);
    osc3.stop(now + 0.35);

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

    playNotification();
  }, [events, enabled]);
}
