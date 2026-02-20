import { memo, useMemo } from 'react';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { TrendingDown, TrendingUp, Flame, Trophy, BarChart3 } from 'lucide-react';

interface Props {
  liquidations: WhaleEvent[];
}

interface TimeWindowStats {
  label: string;
  longUsd: number;
  shortUsd: number;
}

interface LargestLiq {
  usdValue: number;
  direction: 'long' | 'short';
  exchange: string;
  price: number;
  timestamp: Date;
}

const fmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

export const LiquidationDashboard = memo(function LiquidationDashboard({ liquidations }: Props) {
  const stats = useMemo(() => {
    const now = Date.now();
    const windows = [
      { label: '1h', ms: 3_600_000 },
      { label: '4h', ms: 14_400_000 },
      { label: '12h', ms: 43_200_000 },
      { label: '24h', ms: 86_400_000 },
    ];

    const timeStats: TimeWindowStats[] = windows.map(({ label, ms }) => {
      let longUsd = 0;
      let shortUsd = 0;
      for (const liq of liquidations) {
        if (now - liq.timestamp.getTime() > ms) continue;
        if (liq.direction === 'long') longUsd += liq.usdValue;
        else shortUsd += liq.usdValue;
      }
      return { label, longUsd, shortUsd };
    });

    // Largest single liquidation
    let largest: LargestLiq | null = null;
    for (const liq of liquidations) {
      if (!largest || liq.usdValue > largest.usdValue) {
        largest = {
          usdValue: liq.usdValue,
          direction: liq.direction || 'long',
          exchange: liq.exchange,
          price: liq.pricePerBtc,
          timestamp: liq.timestamp,
        };
      }
    }

    // Average size
    const avgSize = liquidations.length > 0
      ? liquidations.reduce((s, l) => s + l.usdValue, 0) / liquidations.length
      : 0;

    // Top exchanges
    const exchMap = new Map<string, number>();
    for (const liq of liquidations) {
      exchMap.set(liq.exchange, (exchMap.get(liq.exchange) || 0) + liq.usdValue);
    }
    const topExchanges = [...exchMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { timeStats, largest, avgSize, topExchanges };
  }, [liquidations]);

  if (liquidations.length === 0) return null;

  return (
    <div className="p-3 space-y-3 border-b border-border">
      {/* Time window breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {stats.timeStats.map((tw) => (
          <div key={tw.label} className="rounded-lg bg-card border border-border p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tw.label}</p>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-buy shrink-0" />
              <span className="text-[11px] font-mono font-bold text-buy">{fmt(tw.longUsd)}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-sell shrink-0" />
              <span className="text-[11px] font-mono font-bold text-sell">{fmt(tw.shortUsd)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
              {(tw.longUsd + tw.shortUsd) > 0 && (
                <>
                  <div
                    className="h-full bg-buy rounded-l-full"
                    style={{ width: `${(tw.longUsd / (tw.longUsd + tw.shortUsd)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-sell rounded-r-full"
                    style={{ width: `${(tw.shortUsd / (tw.longUsd + tw.shortUsd)) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row: Largest + Avg + Top Exchanges */}
      <div className="grid grid-cols-3 gap-2">
        {/* Largest */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-liquidation" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Largest</span>
          </div>
          {stats.largest ? (
            <>
              <p className="text-sm font-mono font-bold text-foreground">{fmt(stats.largest.usdValue)}</p>
              <p className={`text-[10px] font-semibold ${stats.largest.direction === 'long' ? 'text-buy' : 'text-sell'}`}>
                {stats.largest.direction === 'long' ? 'LONG' : 'SHORT'} — {stats.largest.exchange}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                @ ${Math.round(stats.largest.price).toLocaleString()} · {stats.largest.timestamp.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
              </p>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">No data</p>
          )}
        </div>

        {/* Avg size */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Avg Size</span>
          </div>
          <p className="text-sm font-mono font-bold text-foreground">{fmt(stats.avgSize)}</p>
          <p className="text-[10px] text-muted-foreground">{liquidations.length} events</p>
        </div>

        {/* Top exchanges */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-liquidation" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Top Exchanges</span>
          </div>
          <div className="space-y-0.5">
            {stats.topExchanges.map(([name, vol]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-[10px] text-foreground font-medium truncate">{name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{fmt(vol)}</span>
              </div>
            ))}
            {stats.topExchanges.length === 0 && (
              <p className="text-[10px] text-muted-foreground">No data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
