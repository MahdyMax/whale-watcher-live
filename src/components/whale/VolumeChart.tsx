import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

export interface VolumePoint {
  time: string;
  value: number;
}

interface VolumeChartProps {
  data: VolumePoint[];
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function VolumeChart({ data }: VolumeChartProps) {
  const latest = data[data.length - 1]?.value ?? 0;

  return (
    <div className="px-4 py-2 border-b border-border flex flex-col h-32">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Volume (1m)
        </span>
        <span className="text-[11px] font-mono font-semibold text-foreground">
          {formatUsd(latest)}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--liquidation))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--liquidation))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--liquidation))"
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
