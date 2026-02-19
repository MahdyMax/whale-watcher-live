import { useState, useMemo, useRef } from 'react';
import { Header } from '@/components/whale/Header';
import { TransactionCard } from '@/components/whale/TransactionCard';
import { VolumeBar } from '@/components/whale/VolumeBar';
import { ThresholdSlider } from '@/components/whale/ThresholdSlider';
import { useWhaleTransactions } from '@/hooks/useWhaleTransactions';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';
import { Radar } from 'lucide-react';

type Tab = 'spot' | 'futures' | 'liquidations';

const SPOT_EXCHANGES = ['Binance', 'Bybit'];
const FUTURES_EXCHANGES = ['Binance Futures', 'Bybit Futures'];

const Index = () => {
  const [tab, setTab] = useState<Tab>('spot');
  const [minUsd, setMinUsd] = useState(50_000);
  const { events, liquidations, isConnected, error, currentPrice, totalMonitored, volumeStats } =
    useWhaleTransactions(minUsd);

  const cachedRef = useRef<Record<Tab, WhaleEvent[]>>({ spot: [], futures: [], liquidations: [] });

  const allTransactions = useMemo(() => {
    let fresh: WhaleEvent[];

    if (tab === 'liquidations') {
      fresh = liquidations.slice(0, 25);
    } else {
      const exchanges = tab === 'spot' ? SPOT_EXCHANGES : FUTURES_EXCHANGES;
      fresh = events
        .filter((tx) => exchanges.includes(tx.exchange))
        .slice(0, 25);
    }

    if (fresh.length > 0) {
      cachedRef.current[tab] = fresh;
    }
    return cachedRef.current[tab];
  }, [events, liquidations, tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'spot', label: 'Spot' },
    { key: 'futures', label: 'Futures' },
    { key: 'liquidations', label: 'Liquidations' },
  ];

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

      {/* Volume context */}
      <VolumeBar stats={volumeStats} />

      {/* Threshold slider */}
      <ThresholdSlider value={minUsd} onChange={setMinUsd} />

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              tab === t.key
                ? t.key === 'liquidations'
                  ? 'text-liquidation border-b-2 border-liquidation'
                  : 'text-foreground border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-hidden p-3 sm:p-4">
        {allTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 text-muted-foreground">
              <Radar className="h-8 w-8 mx-auto animate-pulse opacity-40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {tab === 'liquidations'
                    ? 'Scanning for liquidation events'
                    : `Scanning for ${tab === 'spot' ? 'spot' : 'futures'} whale trades`}
                </p>
                <p className="text-xs opacity-60">
                  Min threshold: ${minUsd.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-1 overflow-y-auto h-full scrollbar-thin">
            {allTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                labelOverride={
                  tab === 'futures' && tx.type !== 'liquidation'
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
