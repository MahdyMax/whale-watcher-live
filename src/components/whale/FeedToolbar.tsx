import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { WhaleEvent, VolumeStats } from '@/hooks/useWhaleTransactions';

/* ── Exchange Filter Chips ── */
interface ExchangeFilterProps {
  exchanges: string[];
  active: Set<string>;
  onToggle: (exchange: string) => void;
}

export function ExchangeFilterChips({ exchanges, active, onToggle }: ExchangeFilterProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto scrollbar-thin">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Filter:</span>
      {exchanges.map((ex) => (
        <button
          key={ex}
          onClick={() => onToggle(ex)}
          className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm border transition-colors shrink-0 ${
            active.has(ex)
              ? 'bg-foreground/10 border-foreground/20 text-foreground'
              : 'bg-transparent border-border text-muted-foreground/50 line-through'
          }`}
        >
          {ex.replace(' Futures', '')}
        </button>
      ))}
    </div>
  );
}

/* ── Buy/Sell Ratio Counter ── */
interface RatioCounterProps {
  volumeStats: VolumeStats;
}

export function BuySellRatioCounter({ volumeStats }: RatioCounterProps) {
  const total1m = volumeStats.buy1m + volumeStats.sell1m;
  const total5m = volumeStats.buy5m + volumeStats.sell5m;
  const total15m = volumeStats.buy15m + volumeStats.sell15m;

  const ratio1m = total1m > 0 ? (volumeStats.buy1m / total1m) * 100 : 50;
  const ratio5m = total5m > 0 ? (volumeStats.buy5m / total5m) * 100 : 50;
  const ratio15m = total15m > 0 ? (volumeStats.buy15m / total15m) * 100 : 50;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">B/S Ratio</span>
      {[
        { label: '1m', ratio: ratio1m },
        { label: '5m', ratio: ratio5m },
        { label: '15m', ratio: ratio15m },
      ].map(({ label, ratio }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <div className="w-16 h-1.5 bg-sell/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-buy rounded-full transition-all duration-500"
              style={{ width: `${ratio}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono font-bold ${ratio > 55 ? 'text-buy' : ratio < 45 ? 'text-sell' : 'text-muted-foreground'}`}>
            {ratio.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Running Total Ticker ── */
interface RunningTotalProps {
  events: WhaleEvent[];
  tab: 'spot' | 'futures';
}

function fmtVol(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function RunningTotalTicker({ events, tab }: RunningTotalProps) {
  const buyTotal = events.filter((e) => e.type === 'buy').reduce((s, e) => s + e.usdValue, 0);
  const sellTotal = events.filter((e) => e.type === 'sell').reduce((s, e) => s + e.usdValue, 0);
  const net = buyTotal - sellTotal;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[10px] font-mono">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground uppercase tracking-wider">Session</span>
        <span className="text-buy font-bold">{tab === 'futures' ? 'LONG' : 'BUY'} {fmtVol(buyTotal)}</span>
        <span className="text-sell font-bold">{tab === 'futures' ? 'SHORT' : 'SELL'} {fmtVol(sellTotal)}</span>
      </div>
      <span className={`font-bold ${net > 0 ? 'text-buy' : net < 0 ? 'text-sell' : 'text-muted-foreground'}`}>
        NET {net > 0 ? '+' : ''}{fmtVol(net)}
      </span>
    </div>
  );
}

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

/* ── Copy Trade Details helper ── */
export function useCopyTrade() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyTrade = (tx: WhaleEvent) => {
    const text = `${tx.type.toUpperCase()} ${tx.coin} $${tx.usdValue.toLocaleString()} (${tx.btcAmount} ${tx.coin}) on ${tx.exchange} at ${tx.timestamp.toLocaleTimeString()}`;
    navigator.clipboard.writeText(text);
    setCopiedId(tx.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return { copiedId, copyTrade };
}

export function CopyButton({ tx, copiedId, onCopy }: { tx: WhaleEvent; copiedId: string | null; onCopy: (tx: WhaleEvent) => void }) {
  const isCopied = copiedId === tx.id;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCopy(tx); }}
      className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
      title="Copy trade details"
    >
      {isCopied ? <Check className="h-2.5 w-2.5 text-buy" /> : <Copy className="h-2.5 w-2.5" />}
    </button>
  );
}
