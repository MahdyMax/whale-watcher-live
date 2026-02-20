import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import type { CvdPoint } from '@/hooks/useWhaleTransactions';

interface CvdChartProps {
  data: CvdPoint[];
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

export function CvdChart({ data }: CvdChartProps) {
  const latest = data[data.length - 1]?.cvd ?? 0;
  const positive = latest >= 0;

  return (
    <div className="px-4 py-2 border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          CVD (Cumulative Volume Delta)
        </span>
        <span className={`text-[11px] font-mono font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
          {positive ? '+' : ''}{formatUsd(latest)}
        </span>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cvdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <Area
              type="monotone"
              dataKey="cvd"
              stroke={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'}
              strokeWidth={1.5}
              fill="url(#cvdGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
