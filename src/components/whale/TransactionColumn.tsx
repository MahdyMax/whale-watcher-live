import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { TransactionCard } from './TransactionCard';
import { TrendingUp, TrendingDown, Radar } from 'lucide-react';

interface Props {
  title: string;
  transactions: WhaleEvent[];
  type: 'buy' | 'sell';
}

export function TransactionColumn({ title, transactions, type }: Props) {
  const isBuy = type === 'buy';

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
        {isBuy ? (
          <TrendingUp className="h-3.5 w-3.5 text-buy" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-sell" />
        )}
        <h2
          className={`text-xs font-bold uppercase tracking-widest ${
            isBuy ? 'text-buy' : 'text-sell'
          }`}
        >
          {title}
        </h2>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {transactions.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 text-muted-foreground">
              <Radar className="h-8 w-8 mx-auto animate-pulse opacity-40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Scanning for whale {type}s</p>
                <p className="text-xs opacity-60">$1 – $10M threshold</p>
              </div>
            </div>
          </div>
        ) : (
          transactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} />
          ))
        )}
      </div>
    </div>
  );
}
