import hashLogo from '@/assets/hashlogo02.png';

type Tab = 'spot' | 'futures' | 'analytics';

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
  { key: 'analytics', label: 'Analytics' },
];

export function Header({ isConnected, currentPrice, totalMonitored, coinSymbol = 'BTC', tab, onTabChange }: HeaderProps) {
  return (
    <header className="border-b border-border">
      {/* Top row: Logo, Price, Status */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2">
        <div className="flex items-center gap-2 shrink-0">
          <img src={hashLogo} alt="HASH logo" style={{ height: '25px' }} />
          <h1 className="text-lg sm:text-xl tracking-tight" style={{ fontFamily: "'Jersey 10', cursive" }}>
            HASH
          </h1>
        </div>

        {/* Desktop tabs - centered */}
        <nav className="hidden md:flex items-center gap-0.5 mx-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                tab === t.key
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {currentPrice > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground">{coinSymbol}/USD</span>
              <span className="text-sm font-mono font-semibold">
                ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: currentPrice < 1 ? 4 : currentPrice < 100 ? 2 : 0 })}
              </span>
            </div>
          )}

          {/* <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-buy animate-pulse' : 'bg-sell'
              }`}
            />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div> */}
        </div>
      </div>

      {/* Mobile tabs - below logo row */}
      <nav className="flex md:hidden items-center justify-center gap-1 px-2 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors text-center ${
              tab === t.key
                ? 'text-foreground bg-muted'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
