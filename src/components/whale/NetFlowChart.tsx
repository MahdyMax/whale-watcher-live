import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';

export interface NetFlowPoint {
  time: string;
  value: number;
}

interface NetFlowChartProps {
  data: NetFlowPoint[];
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${value >= 0 ? '+' : ''}${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${value >= 0 ? '+' : ''}${(value / 1_000).toFixed(0)}K`;
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`;
}

export function NetFlowChart({ data }: NetFlowChartProps) {
  const latest = data[data.length - 1]?.value ?? 0;
  const positive = latest >= 0;

  return (
    <div className="px-4 py-2 border-b border-border flex flex-col h-32">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Net Flow (5m)
        </span>
        <span className={`text-[11px] font-mono font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
          {formatUsd(latest)}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="netFlowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? 'hsl(var(--buy))' : 'hsl(var(--sell))'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={positive ? 'hsl(var(--buy))' : 'hsl(var(--sell))'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="value"
              stroke={positive ? 'hsl(var(--buy))' : 'hsl(var(--sell))'}
              strokeWidth={1.5}
              fill="url(#netFlowGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
