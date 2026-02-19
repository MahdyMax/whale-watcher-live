import { memo } from 'react';
import type { WhaleTransaction } from '@/hooks/useWhaleTransactions';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const TransactionCard = memo(function TransactionCard({ tx }: { tx: WhaleTransaction }) {
  const isBuy = tx.type === 'buy';

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-none text-xs font-mono animate-fade-in ${
        isBuy
          ? 'bg-buy-muted border-b border-buy/15'
          : 'bg-sell-muted border-b border-sell/15'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isBuy ? (
          <ArrowUpRight className="h-3 w-3 text-buy shrink-0" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-sell shrink-0" />
        )}
        <span className={`font-bold ${isBuy ? 'text-buy' : 'text-sell'}`}>
          ${tx.usdValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          {tx.btcAmount.toFixed(4)} BTC
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
          {tx.exchange}
        </span>
        <span className="text-muted-foreground text-[10px]">
          {tx.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
});
