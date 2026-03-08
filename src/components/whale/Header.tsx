import { Activity } from 'lucide-react';

type Tab = 'spot' | 'futures' | 'liquidations' | 'analytics';

interface HeaderProps {
  isConnected: boolean;
  currentPrice: number;
  totalMonitored: number;
  coinSymbol?: string;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'spot', label: 'Spot' },
  { key: 'futures', label: 'Futures' },
  { key: 'liquidations', label: 'Liquidations' },
  { key: 'analytics', label: 'Analytics' },
];

export function Header({ isConnected, currentPrice, totalMonitored, coinSymbol = 'BTC', tab, onTabChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-border">
      <div className="flex items-center gap-2.5 shrink-0">
        <Activity className="h-5 w-5 text-buy" />
        <h1 className="text-base sm:text-lg font-semibold tracking-tight">
          Trackr
        </h1>
      </div>

      {/* Centered tabs */}
      <nav className="flex items-center gap-0.5 mx-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-sm transition-colors ${
              tab === t.key
                ? t.key === 'liquidations'
                  ? 'text-liquidation bg-liquidation-muted'
                  : 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
        {currentPrice > 0 && (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground">{coinSymbol}/USD</span>
            <span className="text-sm font-mono font-semibold">
              ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: currentPrice < 1 ? 4 : currentPrice < 100 ? 2 : 0 })}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-buy animate-pulse' : 'bg-sell'
            }`}
          />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
