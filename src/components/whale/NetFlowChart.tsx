import { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { NetFlowPoint, SpotFuturesDivergence } from '@/hooks/useWhaleTransactions';

type TimeFrame = '1m' | '5m' | '15m';

interface NetFlowChartProps {
  history: { '1m': NetFlowPoint[]; '5m': NetFlowPoint[]; '15m': NetFlowPoint[] };
  divergence: SpotFuturesDivergence;
  fill?: boolean;
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

export function NetFlowChart({ history, divergence, fill = false }: NetFlowChartProps) {
  const [tf, setTf] = useState<TimeFrame>('5m');
  
  const data = history[tf];
  const latestSpot = data[data.length - 1]?.spot ?? 0;
  const latestFutures = data[data.length - 1]?.futures ?? 0;

  return (
    <div className={`px-4 py-2 flex flex-col ${fill ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
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

      {/* Values */}
      <div className="flex items-center gap-4 text-[10px] font-mono mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Spot:</span>
          <span className={`font-semibold ${latestSpot >= 0 ? 'text-buy' : 'text-sell'}`}>
            {latestSpot >= 0 ? '+' : '-'}{formatUsd(latestSpot)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Futures:</span>
          <span className={`font-semibold ${latestFutures >= 0 ? 'text-buy' : 'text-sell'}`}>
            {latestFutures >= 0 ? '+' : '-'}{formatUsd(latestFutures)}
          </span>
        </div>
      </div>

      {/* Divergence Alert */}
      {divergence.divergent && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono animate-pulse mb-1">
          <AlertTriangle className="h-3 w-3 text-liquidation" />
          <span className="text-liquidation font-semibold">
            DIVERGENCE: Spot {divergence.spotBias.toUpperCase()} / Futures {divergence.futuresBias.toUpperCase()}
          </span>
          <span className="text-muted-foreground">({divergence.magnitude}%)</span>
        </div>
      )}

      {/* Dual Charts */}
      <div className={`flex flex-row gap-1 mb-[20px] ${fill ? 'flex-1 min-h-0' : ''}`}>
        {/* Spot Chart */}
        <div className="flex-1 min-h-0">
          <div className="text-[9px] text-muted-foreground mb-0.5">SPOT</div>
          <div className="h-full" style={{ minHeight: fill ? undefined : 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="spotGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={latestSpot >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={latestSpot >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['auto', 'auto']} hide />
                <ReferenceLine y={0} stroke="hsl(0, 0%, 30%)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="spot"
                  stroke={latestSpot >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
                  strokeWidth={1.5}
                  fill="url(#spotGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Futures Chart */}
        <div className="flex-1 min-h-0">
          <div className="text-[9px] text-muted-foreground mb-0.5">FUTURES</div>
          <div className="h-full" style={{ minHeight: fill ? undefined : 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="futuresGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={latestFutures >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={latestFutures >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['auto', 'auto']} hide />
                <ReferenceLine y={0} stroke="hsl(0, 0%, 30%)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="futures"
                  stroke={latestFutures >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
                  strokeWidth={1.5}
                  fill="url(#futuresGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

            {/* Values */}
      <div className="flex items-center gap-4 text-[10px] font-mono mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Spot:</span>
          <span className={`font-semibold ${latestSpot >= 0 ? 'text-buy' : 'text-sell'}`}>
            {latestSpot >= 0 ? '+' : '-'}{formatUsd(latestSpot)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Futures:</span>
          <span className={`font-semibold ${latestFutures >= 0 ? 'text-buy' : 'text-sell'}`}>
            {latestFutures >= 0 ? '+' : '-'}{formatUsd(latestFutures)}
          </span>
        </div>
      </div>

      {/* Divergence Alert */}
      {divergence.divergent && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono animate-pulse mb-1">
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
