import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { RotateCcw } from 'lucide-react';
import type { CvdPoint } from '@/hooks/useWhaleTransactions';

interface CvdChartProps {
  data: CvdPoint[];
  fill?: boolean;
  onReset?: () => void;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

export function CvdChart({ data, fill = false, onReset }: CvdChartProps) {
  const latest = data[data.length - 1]?.cvd ?? 0;
  const positive = latest >= 0;

  // Detect absorption zones: CVD flat while price moving
  // Simple heuristic: check if CVD barely changed in last 10 points but price did
  const absorptionDetected = data.length >= 10 && (() => {
    const recent = data.slice(-10);
    const cvdRange = Math.abs(Math.max(...recent.map(d => d.cvd)) - Math.min(...recent.map(d => d.cvd)));
    const priceRange = Math.abs(Math.max(...recent.map(d => d.price)) - Math.min(...recent.map(d => d.price)));
    const avgPrice = recent.reduce((s, d) => s + d.price, 0) / recent.length;
    // CVD is flat (< 5% of total) and price moved > 0.1%
    return cvdRange < Math.abs(latest) * 0.05 && priceRange > avgPrice * 0.001 && avgPrice > 0;
  })();

  return (
    <div className={`px-4 py-2 border-b border-border flex flex-col ${fill ? 'h-full' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            CVD (Cumulative Volume Delta)
          </span>
          {absorptionDetected && (
            <span className="text-[9px] font-mono text-mega font-semibold animate-pulse">
              🧱 ABSORPTION
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
            {positive ? '+' : ''}{formatUsd(latest)}
          </span>
          {onReset && (
            <button
              onClick={onReset}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Reset CVD"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className={fill ? 'flex-1 min-h-0' : 'h-12'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cvdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={positive ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <ReferenceLine y={0} stroke="hsl(0, 0%, 30%)" strokeDasharray="3 3" />
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
