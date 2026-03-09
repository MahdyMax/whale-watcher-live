import type { WhaleEvent } from '@/hooks/useWhaleTransactions';

/* ── Trade Direction Summary Bar ── */
interface DirectionSummaryProps {
  events: WhaleEvent[];
  tab: 'spot' | 'futures';
}

export function TradeDirectionSummary({ events, tab }: DirectionSummaryProps) {
  const buyCount = events.filter((e) => e.type === 'buy').length;
  const sellCount = events.filter((e) => e.type === 'sell').length;
  const total = buyCount + sellCount;
  const buyPct = total > 0 ? (buyCount / total) * 100 : 50;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">Direction</span>
      <div className="flex-1 h-2 bg-sell/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-buy/80 rounded-full transition-all duration-500"
          style={{ width: `${buyPct}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
        <span className="text-buy font-bold">{buyCount} {tab === 'futures' ? 'L' : 'B'}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-sell font-bold">{sellCount} {tab === 'futures' ? 'S' : 'S'}</span>
      </div>
    </div>
  );
}
