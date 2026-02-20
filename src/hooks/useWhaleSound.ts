import { useRef, useEffect } from 'react';
import type { WhaleEvent } from './useWhaleTransactions';

// Play a coin/cha-ching sound using Web Audio API
function playCoin() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First clink - high metallic hit
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(2400, now);
    osc1.frequency.exponentialRampToValueAtTime(3200, now + 0.02);
    osc1.frequency.exponentialRampToValueAtTime(2000, now + 0.08);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    // Second clink - slightly delayed, higher pitch
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(3200, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(4200, now + 0.09);
    osc2.frequency.exponentialRampToValueAtTime(2800, now + 0.18);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.setValueAtTime(0.12, now + 0.07);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Shimmer ring-out
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(5500, now + 0.05);

    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0, now);
    g3.gain.setValueAtTime(0.06, now + 0.05);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(g1).connect(ctx.destination);
    osc2.connect(g2).connect(ctx.destination);
    osc3.connect(g3).connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.07);
    osc3.start(now + 0.05);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.2);
    osc3.stop(now + 0.3);

    setTimeout(() => ctx.close(), 400);
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

    playCoin();
  }, [events, enabled]);
}
