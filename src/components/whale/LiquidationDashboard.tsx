import { memo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, TrendingUp, Flame, Trophy, BarChart3, RefreshCw } from 'lucide-react';

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
}

const fmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

export const LiquidationDashboard = memo(function LiquidationDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke('liquidation-data');
      if (error) throw error;
      setData(resp as ApiResponse);
      setLastFetch(new Date());
    } catch (e) {
      console.error('[Dashboard] Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-3 space-y-3 border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">BTC Liquidation Summary</h3>
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
        {(data?.timeBreakdown || [{ label: '1h', longUsd: 0, shortUsd: 0 }, { label: '4h', longUsd: 0, shortUsd: 0 }, { label: '12h', longUsd: 0, shortUsd: 0 }, { label: '24h', longUsd: 0, shortUsd: 0 }]).map((tw) => (
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
          {data?.largest ? (
            <>
              <p className="text-sm font-mono font-bold text-foreground">{fmt(data.largest.usdValue)}</p>
              <p className={`text-[10px] font-semibold ${data.largest.direction === 'long' ? 'text-buy' : 'text-sell'}`}>
                {data.largest.direction === 'long' ? 'LONG' : 'SHORT'} — {data.largest.exchange}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                @ ${Math.round(data.largest.price).toLocaleString()} · {new Date(data.largest.timestamp).toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
              </p>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">Accumulating...</p>
          )}
        </div>

        {/* Avg size */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Avg Size</span>
          </div>
          <p className="text-sm font-mono font-bold text-foreground">{fmt(data?.avgSize || 0)}</p>
          <p className="text-[10px] text-muted-foreground">{(data?.totalEvents || 0).toLocaleString()} events</p>
        </div>

        {/* Top exchanges */}
        <div className="rounded-lg bg-card border border-border p-2 space-y-1">
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-liquidation" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Top Exchanges</span>
          </div>
          <div className="space-y-0.5">
            {(data?.topExchanges || []).map((ex) => (
              <div key={ex.name} className="flex items-center justify-between">
                <span className="text-[10px] text-foreground font-medium truncate">{ex.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{fmt(ex.volume)}</span>
              </div>
            ))}
            {(!data?.topExchanges || data.topExchanges.length === 0) && (
              <p className="text-[10px] text-muted-foreground">Accumulating...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
