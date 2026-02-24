import { memo } from 'react';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { ExchangeIcon } from './ExchangeIcon';

interface TransactionCardProps {
  tx: WhaleEvent;
  labelOverride?: string;
}

export const TransactionCard = memo(function TransactionCard({ tx, labelOverride }: TransactionCardProps) {
  const isBuy = tx.type === 'buy';
  const isLiq = tx.type === 'liquidation';
  const isMega = isLiq && (tx.isMega || tx.usdValue >= 2_000_000);
  const label = labelOverride ?? (isLiq ? (tx.direction === 'long' ? 'LONG LIQ' : 'SHORT LIQ') : tx.type);

  const colorClass = isMega
    ? 'text-mega'
    : isLiq
    ? 'text-liquidation'
    : isBuy
    ? 'text-buy'
    : 'text-sell';

  const bgClass = isMega
    ? 'bg-mega-muted border-mega/20'
    : isLiq
    ? 'bg-liquidation-muted border-liquidation/15'
    : isBuy
    ? 'bg-buy-muted border-buy/15'
    : 'bg-sell-muted border-sell/15';

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-none text-xs font-mono animate-fade-in ${bgClass} border-b`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isLiq ? (
          <Zap className={`h-3 w-3 ${colorClass} shrink-0`} />
        ) : isBuy ? (
          <ArrowUpRight className={`h-3 w-3 ${colorClass} shrink-0`} />
        ) : (
          <ArrowDownRight className={`h-3 w-3 ${colorClass} shrink-0`} />
        )}
        <span className={`font-bold uppercase tracking-wider ${colorClass}`}>
          {label}
        </span>
        <span className={`font-bold ${colorClass}`}>
          ${tx.usdValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          {tx.btcAmount.toFixed(4)} BTC
        </span>
        {tx.tradeCount > 1 && (
          <span className="text-muted-foreground text-[10px]">
            ({tx.tradeCount} trades)
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {tx.exchange.includes('Futures') && tx.type !== 'liquidation' && (() => {
          const estLeverage = tx.usdValue >= 1_000_000 ? 50
            : tx.usdValue >= 500_000 ? 25
            : tx.usdValue >= 200_000 ? 20
            : tx.usdValue >= 100_000 ? 10
            : 5;
          return (
            <span className="text-muted-foreground font-bold uppercase tracking-wider">
              ~{estLeverage}X
            </span>
          );
        })()}
        <ExchangeIcon exchange={tx.exchange} />
        <span className="text-muted-foreground text-[10px]">
          {tx.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
});
