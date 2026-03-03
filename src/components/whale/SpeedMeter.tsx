import { Gauge, Zap } from 'lucide-react';
import type { SpeedStats } from '@/hooks/useWhaleTransactions';

interface SpeedMeterProps {
  stats: SpeedStats;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function SpeedMeter({ stats }: SpeedMeterProps) {
  const intensityColor =
    stats.intensity === 'high'
      ? 'text-sell'
      : stats.intensity === 'medium'
      ? 'text-liquidation'
      : 'text-muted-foreground';

  return (
    <div className="px-4 py-2 border-b border-border space-y-1">
      {/* Row 1: main speed metrics */}
      <div className="flex items-center gap-4 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <Gauge className={`h-3 w-3 ${intensityColor}`} />
          <span className="text-muted-foreground uppercase tracking-wider">Speed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Trades/s:</span>
          <span className={`font-semibold ${intensityColor}`}>{stats.tradesPerSec}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Vol/s:</span>
          <span className={`font-semibold ${intensityColor}`}>{formatUsd(stats.volumePerSec)}</span>
        </div>
      </div>

      {/* Row 2: whale/min, liq/min, spike */}
      <div className="flex items-center gap-4 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">🐋 Whale/min:</span>
          <span className="text-foreground font-semibold">{stats.whalesPerMin}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">⚡ Liq/min:</span>
          <span className="text-foreground font-semibold">{stats.liqsPerMin}</span>
        </div>
        {stats.spike && (
          <div className="flex items-center gap-1 animate-pulse">
            <Zap className="h-3 w-3 text-liquidation" />
            <span className="text-liquidation font-bold uppercase">Spike!</span>
          </div>
        )}
        {stats.intensity === 'high' && !stats.spike && (
          <span className="text-sell font-semibold animate-pulse">⚡ HIGH VOLATILITY</span>
        )}
      </div>
    </div>
  );
}
