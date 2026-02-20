import type { ExchangeImbalance as ExchangeImbalanceType } from '@/hooks/useWhaleTransactions';

interface ExchangeImbalanceProps {
  imbalances: ExchangeImbalanceType[];
}

export function ExchangeImbalanceBar({ imbalances }: ExchangeImbalanceProps) {
  if (imbalances.length === 0) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border text-[11px] font-mono">
      {imbalances.map((ex) => (
        <div key={ex.exchange} className="flex items-center gap-1.5">
          <span className="text-muted-foreground uppercase tracking-wider">{ex.exchange}:</span>
          <span
            className={`font-semibold ${
              ex.label === 'Heavy Buying'
                ? 'text-buy'
                : ex.label === 'Heavy Selling'
                ? 'text-sell'
                : 'text-muted-foreground'
            }`}
          >
            {ex.label}
          </span>
        </div>
      ))}
    </div>
  );
}
