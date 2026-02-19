import type { VolumeStats } from '@/hooks/useWhaleTransactions';

interface VolumeBarProps {
  stats: VolumeStats;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

export function VolumeBar({ stats }: VolumeBarProps) {
  const total1m = stats.buy1m + stats.sell1m;
  const buyPct1m = total1m > 0 ? (stats.buy1m / total1m) * 100 : 50;

  const total5m = stats.buy5m + stats.sell5m;
  const buyPct5m = total5m > 0 ? (stats.buy5m / total5m) * 100 : 50;

  return (
    <div className="px-4 py-2 border-b border-border space-y-1.5">
      {/* 1m volume */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-muted-foreground w-6 shrink-0">1m</span>
        <span className="text-buy w-14 text-right">${formatUsd(stats.buy1m)}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-buy transition-all duration-500"
            style={{ width: `${buyPct1m}%` }}
          />
          <div
            className="h-full bg-sell transition-all duration-500"
            style={{ width: `${100 - buyPct1m}%` }}
          />
        </div>
        <span className="text-sell w-14">${formatUsd(stats.sell1m)}</span>
        <span
          className={`w-16 text-right font-semibold ${
            stats.netDelta1m >= 0 ? 'text-buy' : 'text-sell'
          }`}
        >
          {stats.netDelta1m >= 0 ? '+' : ''}${formatUsd(stats.netDelta1m)}
        </span>
      </div>

      {/* 5m volume */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-muted-foreground w-6 shrink-0">5m</span>
        <span className="text-buy w-14 text-right">${formatUsd(stats.buy5m)}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-buy transition-all duration-500"
            style={{ width: `${buyPct5m}%` }}
          />
          <div
            className="h-full bg-sell transition-all duration-500"
            style={{ width: `${100 - buyPct5m}%` }}
          />
        </div>
        <span className="text-sell w-14">${formatUsd(stats.sell5m)}</span>
        <span
          className={`w-16 text-right font-semibold ${
            stats.netDelta5m >= 0 ? 'text-buy' : 'text-sell'
          }`}
        >
          {stats.netDelta5m >= 0 ? '+' : ''}${formatUsd(stats.netDelta5m)}
        </span>
      </div>
    </div>
  );
}
