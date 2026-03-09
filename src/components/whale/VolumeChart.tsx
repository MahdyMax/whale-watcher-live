import { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import type { VolumePoint, VolumeStats } from '@/hooks/useWhaleTransactions';

type TimeFrame = '1m' | '5m' | '15m';

interface VolumeChartProps {
  history: { '1m': VolumePoint[]; '5m': VolumePoint[]; '15m': VolumePoint[] };
  stats: VolumeStats;
  fill?: boolean;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

function getHeatColor(anomalyRatio: number): string {
  if (anomalyRatio >= 3) return 'text-sell';
  if (anomalyRatio >= 2) return 'text-liquidation';
  if (anomalyRatio >= 1.5) return 'text-buy';
  return 'text-muted-foreground';
}

function getHeatLabel(anomalyRatio: number): string {
  if (anomalyRatio >= 3) return '🔥 EXTREME';
  if (anomalyRatio >= 2) return '🟠 HIGH';
  if (anomalyRatio >= 1.5) return '🟡 ELEVATED';
  if (anomalyRatio >= 0.5) return 'NORMAL';
  return '🔵 LOW';
}

export function VolumeChart({ history, stats, fill = false }: VolumeChartProps) {
  const [tf, setTf] = useState<TimeFrame>('5m');
  
  const data = history[tf];
  const latest = data[data.length - 1]?.net ?? 0;
  const positive = latest >= 0;
  
  const heatColor = getHeatColor(stats.volumeAnomalyRatio);
  const heatLabel = getHeatLabel(stats.volumeAnomalyRatio);

  return (
    <div className={`px-4 py-2 flex flex-col ${fill ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Volume
          </span>
          <span className={`text-[9px] font-mono font-semibold ${heatColor}`}>
            Rel: {stats.volumeAnomalyRatio.toFixed(1)}x {heatLabel}
          </span>
        </div>
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

      {/* Net value */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">Net Delta:</span>
        <span className={`text-[11px] font-mono font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
          {positive ? '+' : ''}${formatUsd(latest)}
        </span>
      </div>

      {/* Chart */}
      <div className={fill ? 'flex-1 min-h-0' : 'h-24'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <ReferenceLine y={0} stroke="hsl(0, 0%, 30%)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="net"
              stroke={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
              strokeWidth={1.5}
              fill="url(#volumeGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
