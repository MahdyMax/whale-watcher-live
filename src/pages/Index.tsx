import { useState, useMemo } from 'react';
import { Header } from '@/components/whale/Header';
import { TransactionCard } from '@/components/whale/TransactionCard';
import { useWhaleTransactions } from '@/hooks/useWhaleTransactions';
import { Radar } from 'lucide-react';

type Tab = 'spot' | 'futures';

const SPOT_EXCHANGES = ['Binance', 'Bybit'];
const FUTURES_EXCHANGES = ['Binance Futures', 'Bybit Futures'];

const Index = () => {
  const [tab, setTab] = useState<Tab>('spot');
  const { buys, sells, isConnected, error, currentPrice, totalMonitored } =
    useWhaleTransactions();

  const allTransactions = useMemo(() => {
    const exchanges = tab === 'spot' ? SPOT_EXCHANGES : FUTURES_EXCHANGES;
    return [...buys, ...sells]
      .filter((tx) => exchanges.includes(tx.exchange))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 25);
  }, [buys, sells, tab]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Header
        isConnected={isConnected}
        currentPrice={currentPrice}
        totalMonitored={totalMonitored}
      />

      {error && (
        <div className="px-4 py-1.5 bg-sell-muted text-sell text-xs text-center font-medium">
          {error} — Reconnecting...
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('spot')}
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'spot'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Spot
        </button>
        <button
          onClick={() => setTab('futures')}
          className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'futures'
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Leverage / Futures
        </button>
      </div>

      <main className="flex-1 overflow-hidden p-3 sm:p-4">
        {allTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 text-muted-foreground">
              <Radar className="h-8 w-8 mx-auto animate-pulse opacity-40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Scanning for {tab === 'spot' ? 'spot' : 'leverage'} trades
                </p>
                <p className="text-xs opacity-60">$1 – $10M threshold</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-1 h-full overflow-y-auto">
            {allTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                labelOverride={
                  tab === 'futures'
                    ? tx.type === 'buy'
                      ? 'long'
                      : 'short'
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
