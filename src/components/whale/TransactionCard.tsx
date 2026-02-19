import { memo } from 'react';
import type { WhaleTransaction } from '@/hooks/useWhaleTransactions';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const TransactionCard = memo(function TransactionCard({ tx }: { tx: WhaleTransaction }) {
  const isBuy = tx.type === 'buy';

  return (
    <div
      className={`glass rounded-xl p-4 space-y-2.5 border-l-2 animate-fade-in ${
        isBuy ? 'border-l-buy' : 'border-l-sell'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isBuy ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-buy" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-sell" />
          )}
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              isBuy ? 'text-buy' : 'text-sell'
            }`}
          >
            {tx.type}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {tx.timestamp.toLocaleTimeString()}
        </span>
      </div>

      <p className="text-xl font-bold font-mono tracking-tight">
        ${tx.usdValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>{tx.btcAmount.toFixed(4)} BTC</span>
        <span>
          @ ${tx.pricePerBtc.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {tx.exchange}
        </span>
        <div
          className={`h-1 w-16 rounded-full overflow-hidden ${
            isBuy ? 'bg-buy-muted' : 'bg-sell-muted'
          }`}
        >
          <div
            className={`h-full rounded-full ${isBuy ? 'bg-buy' : 'bg-sell'}`}
            style={{ width: `${Math.min((tx.usdValue / 10_000_000) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
});
