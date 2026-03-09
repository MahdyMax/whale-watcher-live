import { memo } from 'react';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { COIN_DECIMALS } from '@/hooks/useWhaleTransactions';
import { ArrowUpRight, ArrowDownRight, Zap, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { ExchangeIcon } from './ExchangeIcon';

interface Props {
  tx: WhaleEvent;
  labelOverride?: string;
  maxUsd: number;
  isCluster?: boolean;
  showTimeHeader?: string | null;
}

function estimatePriceImpact(usdValue: number): { pct: string; level: 'low' | 'mid' | 'high' } {
  // Rough estimate based on typical order book depth
  if (usdValue >= 5_000_000) return { pct: '>0.5%', level: 'high' };
  if (usdValue >= 2_000_000) return { pct: '~0.2%', level: 'high' };
  if (usdValue >= 1_000_000) return { pct: '~0.1%', level: 'mid' };
  if (usdValue >= 500_000) return { pct: '~0.05%', level: 'mid' };
  return { pct: '<0.05%', level: 'low' };
}

export const EnhancedTransactionCard = memo(function EnhancedTransactionCard({
  tx, labelOverride, maxUsd, copiedId, onCopy, isCluster, showTimeHeader,
}: Props) {
  const isBuy = tx.type === 'buy';
  const isLiq = tx.type === 'liquidation';
  const isMega = isLiq && (tx.isMega || tx.usdValue >= 2_000_000);
  const label = labelOverride ?? (isLiq ? (tx.direction === 'long' ? 'LONG LIQ' : 'SHORT LIQ') : tx.type);

  const colorClass = isMega ? 'text-mega' : isLiq ? 'text-liquidation' : isBuy ? 'text-buy' : 'text-sell';
  const bgClass = isMega
    ? 'bg-mega-muted border-mega/20'
    : isLiq ? 'bg-liquidation-muted border-liquidation/15'
    : isBuy ? 'bg-buy-muted border-buy/15'
    : 'bg-sell-muted border-sell/15';

  // Heatmap bar width (relative to max in the feed)
  const heatPct = maxUsd > 0 ? Math.min((tx.usdValue / maxUsd) * 100, 100) : 0;
  const heatColor = isMega ? 'bg-mega/15' : isLiq ? 'bg-liquidation/15' : isBuy ? 'bg-buy/15' : 'bg-sell/15';

  // Price impact
  const impact = estimatePriceImpact(tx.usdValue);
  const impactColor = impact.level === 'high' ? colorClass : impact.level === 'mid' ? 'text-muted-foreground' : 'text-muted-foreground/50';

  return (
    <>
      {showTimeHeader && (
        <div className="px-3 py-1 text-[9px] text-muted-foreground/60 uppercase tracking-widest font-mono border-b border-border/50 bg-muted/30">
          {showTimeHeader}
        </div>
      )}
      <div
        className={`relative flex items-center justify-between px-3 py-2 rounded-none text-xs font-mono animate-fade-in ${bgClass} border-b overflow-hidden cursor-pointer group`}
        onClick={() => onCopy(tx)}
        title="Click to copy"
      >
        {/* Heatmap background bar */}
        <div
          className={`absolute inset-y-0 left-0 ${heatColor} transition-all duration-300`}
          style={{ width: `${heatPct}%` }}
        />

        <div className="relative flex items-center gap-2 min-w-0">
          {isCluster && (
            <span title="Trade cluster detected"><Layers className="h-2.5 w-2.5 text-accent-foreground/60 shrink-0" /></span>
          )}
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
            {tx.btcAmount.toFixed(COIN_DECIMALS[tx.coin] ?? 2)} {tx.coin}
          </span>
          {tx.tradeCount > 1 && (
            <span className="text-muted-foreground text-[10px]">
              ({tx.tradeCount} trades)
            </span>
          )}
          {/* Price impact indicator */}
          <span className={`text-[9px] ${impactColor} hidden sm:inline`} title="Est. price impact">
            {impact.level !== 'low' && (
              impact.level === 'high'
                ? <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" />
                : <TrendingDown className="inline h-2.5 w-2.5 mr-0.5" />
            )}
            {impact.pct}
          </span>
        </div>

        <div className="relative flex items-center gap-2 shrink-0">
          <ExchangeIcon exchange={tx.exchange} />
          <span className="text-muted-foreground text-[10px]">
            {tx.timestamp.toLocaleTimeString()}
          </span>
          <CopyButton tx={tx} copiedId={copiedId} onCopy={onCopy} />
        </div>
      </div>
    </>
  );
});
