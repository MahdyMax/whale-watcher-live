import { useState } from 'react';
import type { ExchangeImbalance as ExchangeImbalanceType } from '@/hooks/useWhaleTransactions';

interface ExchangeImbalanceProps {
  imbalances: ExchangeImbalanceType[];
}

type TimeView = '1m' | '5m';

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function ExchangeImbalanceBar({ imbalances }: ExchangeImbalanceProps) {
  const [view, setView] = useState<TimeView>('1m');

  if (imbalances.length === 0) return null;

  // Find dominant exchange
  const dominant = imbalances[0]; // already sorted by dominance5m

  return (
    <div className="px-4 py-2 border-b border-border space-y-1.5">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Exchange Imbalance
        </span>
        <div className="flex items-center gap-1">
          {(['1m', '5m'] as TimeView[]).map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded transition-colors ${
                view === t
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Exchange rows */}
      {imbalances.map((ex) => {
        const label = view === '1m' ? ex.label1m : ex.label5m;
        const buyVol = view === '1m' ? ex.buyVol1m : ex.buyVol5m;
        const sellVol = view === '1m' ? ex.sellVol1m : ex.sellVol5m;
        const total = buyVol + sellVol;
        const buyPct = total > 0 ? (buyVol / total) * 100 : 50;
        const isDominant = ex === dominant && ex.dominance5m > 30;

        return (
          <div key={ex.exchange} className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`w-16 shrink-0 uppercase tracking-wider ${
              isDominant ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}>
              {ex.exchange}
              {isDominant && <span className="text-liquidation ml-0.5">★</span>}
            </span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-buy transition-all duration-500"
                style={{ width: `${buyPct}%` }}
              />
              <div
                className="h-full bg-sell transition-all duration-500"
                style={{ width: `${100 - buyPct}%` }}
              />
            </div>
            <span
              className={`w-20 text-right font-semibold ${
                label === 'Heavy Buying'
                  ? 'text-buy'
                  : label === 'Heavy Selling'
                  ? 'text-sell'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            <span className="text-muted-foreground w-10 text-right text-[9px]">
              {ex.dominance5m.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
