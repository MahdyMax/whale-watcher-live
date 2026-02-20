import { memo, useMemo, useEffect, useState } from 'react';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, TrendingUp, Flame, Trophy, BarChart3, RefreshCw, Wifi } from 'lucide-react';

interface Props {
  liquidations: WhaleEvent[]; // live WebSocket feed
}

interface ApiTimeWindow {
  label: string;
  longUsd: number;
  shortUsd: number;
  count: number;
}

interface ApiLargest {
  usdValue: number;
  direction: 'long' | 'short';
  exchange: string;
  price: number;
  timestamp: number;
}

interface ApiResponse {
  timeBreakdown: ApiTimeWindow[];
  largest: ApiLargest | null;
  avgSize: number;
  totalEvents: number;
  topExchanges: { name: string; volume: number }[];
  sources: string[];
  note: string;
}

const fmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

export const LiquidationDashboard = memo(function LiquidationDashboard({ liquidations }: Props) {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('liquidation-data');
      if (error) throw error;
      setApiData(data as ApiResponse);
      setLastFetch(new Date());
    } catch (e) {
      console.error('[Dashboard] Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Merge API data with live WebSocket accumulation for Bybit/OKX
  const mergedStats = useMemo(() => {
    const windows = [
      { label: '1h', ms: 3_600_000 },
      { label: '4h', ms: 14_400_000 },
      { label: '12h', ms: 43_200_000 },
      { label: '24h', ms: 86_400_000 },
    ];

    const now = Date.now();

    // Live WebSocket stats (Bybit + OKX only, since Binance comes from API)
    const wsLiqs = liquidations.filter(
      (l) => l.exchange === 'Bybit' || l.exchange === 'OKX'
    );

    const timeStats = windows.map(({ label, ms }) => {
      // API data (Binance)
      const apiWindow = apiData?.timeBreakdown.find((t) => t.label === label);
      let longUsd = apiWindow?.longUsd || 0;
      let shortUsd = apiWindow?.shortUsd || 0;

      // Add live WebSocket data for non-Binance exchanges
      for (const liq of wsLiqs) {
        if (now - liq.timestamp.getTime() > ms) continue;
        if (liq.direction === 'long') longUsd += liq.usdValue;
        else shortUsd += liq.usdValue;
      }

      return { label, longUsd, shortUsd };
    });

    // Largest: compare API vs live
    let largest = apiData?.largest
      ? {
          usdValue: apiData.largest.usdValue,
          direction: apiData.largest.direction,
          exchange: apiData.largest.exchange,
          price: apiData.largest.price,
          timestamp: new Date(apiData.largest.timestamp),
        }
      : null;

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

    // Average size (combine)
    const apiTotal = (apiData?.avgSize || 0) * (apiData?.totalEvents || 0);
    const wsTotal = liquidations.reduce((s, l) => s + l.usdValue, 0);
    const totalEvents = (apiData?.totalEvents || 0) + liquidations.length;
    const avgSize = totalEvents > 0 ? (apiTotal + wsTotal) / totalEvents : 0;

    // Top exchanges (merge)
    const exchMap = new Map<string, number>();
    for (const ex of apiData?.topExchanges || []) {
      exchMap.set(ex.name, ex.volume);
    }
    for (const liq of liquidations) {
      exchMap.set(liq.exchange, (exchMap.get(liq.exchange) || 0) + liq.usdValue);
    }
    const topExchanges = [...exchMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { timeStats, largest, avgSize, totalEvents, topExchanges };
  }, [apiData, liquidations]);

  return (
    <div className="p-3 space-y-3 border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">BTC Liquidation Summary</h3>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wifi className="h-3 w-3 text-buy" />
            <span>Live + API</span>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {lastFetch ? lastFetch.toLocaleTimeString('en-US', { hour12: false }) : '...'}
        </button>
      </div>

      {/* Time window breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {mergedStats.timeStats.map((tw) => (
          <div key={tw.label} className="rounded-lg bg-card border border-border p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tw.label} Rekt</p>
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
          {mergedStats.largest ? (
            <>
              <p className="text-sm font-mono font-bold text-foreground">{fmt(mergedStats.largest.usdValue)}</p>
              <p className={`text-[10px] font-semibold ${mergedStats.largest.direction === 'long' ? 'text-buy' : 'text-sell'}`}>
                {mergedStats.largest.direction === 'long' ? 'LONG' : 'SHORT'} — {mergedStats.largest.exchange}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                @ ${Math.round(mergedStats.largest.price).toLocaleString()} · {mergedStats.largest.timestamp.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
              </p>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">No data yet</p>
          )}
        </div>

        {/* Avg size */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Avg Size</span>
          </div>
          <p className="text-sm font-mono font-bold text-foreground">{fmt(mergedStats.avgSize)}</p>
          <p className="text-[10px] text-muted-foreground">{mergedStats.totalEvents.toLocaleString()} events</p>
        </div>

        {/* Top exchanges */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-liquidation" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Top Exchanges</span>
          </div>
          <div className="space-y-0.5">
            {mergedStats.topExchanges.map(([name, vol]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-[10px] text-foreground font-medium truncate">{name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{fmt(vol)}</span>
              </div>
            ))}
            {mergedStats.topExchanges.length === 0 && (
              <p className="text-[10px] text-muted-foreground">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
