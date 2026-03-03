import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { VolumeStats, SpotFuturesDivergence } from '@/hooks/useWhaleTransactions';

interface NetFlowIndicatorProps {
  volumeStats: VolumeStats;
  divergence: SpotFuturesDivergence;
}

type TimeFrame = '1m' | '5m' | '15m';

function formatFlow(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

export function NetFlowIndicator({ volumeStats, divergence }: NetFlowIndicatorProps) {
  const [tf, setTf] = useState<TimeFrame>('5m');

  const spotNet = tf === '1m' ? volumeStats.spotNet1m : tf === '5m' ? volumeStats.spotNet5m : volumeStats.spotNet15m;
  const futNet = tf === '1m' ? volumeStats.futuresNet1m : tf === '5m' ? volumeStats.futuresNet5m : volumeStats.futuresNet15m;

  return (
    <div className="px-4 py-2 border-b border-border space-y-1.5">
      {/* Header with timeframe toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Net Flow
        </span>
        <div className="flex items-center gap-1">
          {(['1m', '5m', '15m'] as TimeFrame[]).map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded transition-colors ${
                tf === t
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Flow chips */}
      <div className="flex items-center gap-4 text-[11px] font-mono">
        <FlowChip label="Spot" value={spotNet} />
        <FlowChip label="Futures" value={futNet} />
      </div>

      {/* Divergence Alert */}
      {divergence.divergent && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono animate-pulse">
          <AlertTriangle className="h-3 w-3 text-liquidation" />
          <span className="text-liquidation font-semibold">
            DIVERGENCE: Spot {divergence.spotBias.toUpperCase()} / Futures {divergence.futuresBias.toUpperCase()}
          </span>
          <span className="text-muted-foreground">({divergence.magnitude}%)</span>
        </div>
      )}
    </div>
  );
}

function FlowChip({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground uppercase tracking-wider">{label}:</span>
      <Icon className={`h-3 w-3 ${positive ? 'text-buy' : 'text-sell'}`} />
      <span className={`font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
        {positive ? '+' : '-'}{formatFlow(value)}
      </span>
    </div>
  );
}
