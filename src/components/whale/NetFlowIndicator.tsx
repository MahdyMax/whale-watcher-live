import { TrendingUp, TrendingDown } from 'lucide-react';

interface NetFlowIndicatorProps {
  spotNet: number;
  futuresNet: number;
}

function formatFlow(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

export function NetFlowIndicator({ spotNet, futuresNet }: NetFlowIndicatorProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border text-[11px] font-mono">
      <FlowChip label="Spot Net" value={spotNet} />
      <FlowChip label="Futures Net" value={futuresNet} />
    </div>
  );
}

function FlowChip({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground uppercase tracking-wider">{label}:</span>
      <Icon className={`h-3 w-3 ${positive ? 'text-buy' : 'text-sell'}`} />
      <span className={`font-semibold ${positive ? 'text-buy' : 'text-sell'}`}>
        {positive ? '+' : '-'}{formatFlow(value)}
      </span>
    </div>
  );
}
