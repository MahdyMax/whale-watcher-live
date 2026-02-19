import { Activity } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  currentPrice: number;
  totalMonitored: number;
}

export function Header({ isConnected, currentPrice, totalMonitored }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border glass">
      <div className="flex items-center gap-2.5">
        <Activity className="h-5 w-5 text-buy" />
        <h1 className="text-base sm:text-lg font-semibold tracking-tight">
          BTC Whale Tracker
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {currentPrice > 0 && (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs text-muted-foreground">BTC/USD</span>
            <span className="text-sm font-mono font-semibold">
              ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {totalMonitored > 0 && (
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs text-muted-foreground">Trades scanned</span>
            <span className="text-sm font-mono font-medium">
              {totalMonitored.toLocaleString()}
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
