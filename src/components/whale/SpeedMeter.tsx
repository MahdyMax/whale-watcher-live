import { Gauge } from 'lucide-react';
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
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border text-[11px] font-mono">
      <div className="flex items-center gap-1.5">
        <Gauge className={`h-3 w-3 ${intensityColor}`} />
        <span className="text-muted-foreground uppercase tracking-wider">Speed:</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Trades/s:</span>
        <span className={`font-semibold ${intensityColor}`}>{stats.tradesPerSec}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Vol/s:</span>
        <span className={`font-semibold ${intensityColor}`}>{formatUsd(stats.volumePerSec)}</span>
      </div>
      {stats.intensity === 'high' && (
        <span className="text-sell font-semibold animate-pulse">⚡ HIGH VOLATILITY</span>
      )}
    </div>
  );
}
