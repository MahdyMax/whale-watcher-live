import { useState, useMemo, useRef } from 'react';
import { Header } from '@/components/whale/Header';
import { TransactionCard } from '@/components/whale/TransactionCard';
import { VolumeBar } from '@/components/whale/VolumeBar';
import { NetFlowIndicator } from '@/components/whale/NetFlowIndicator';
import { ThresholdSlider } from '@/components/whale/ThresholdSlider';
import { CvdChart } from '@/components/whale/CvdChart';
import { ExchangeImbalanceBar } from '@/components/whale/ExchangeImbalance';
import { SpeedMeter } from '@/components/whale/SpeedMeter';
import { WhaleScoreCard } from '@/components/whale/WhaleScoreCard';
import { useWhaleTransactions, COINS } from '@/hooks/useWhaleTransactions';
import { useWhaleSound } from '@/hooks/useWhaleSound';
import type { WhaleEvent } from '@/hooks/useWhaleTransactions';

import { Radar, Volume2, VolumeX, ChevronDown } from 'lucide-react';

type Tab = 'spot' | 'futures' | 'liquidations' | 'analytics';

const SPOT_EXCHANGES = ['Binance', 'Bybit', 'Coinbase', 'OKX'];
const FUTURES_EXCHANGES = ['Binance Futures', 'Bybit Futures', 'OKX Futures'];

const Index = () => {
  const [tab, setTab] = useState<Tab>('spot');
  const [minUsd, setMinUsd] = useState(25_000);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [coinMenuOpen, setCoinMenuOpen] = useState(false);

  const { events, liquidations, isConnected, error, currentPrice, totalMonitored, volumeStats, cvdHistory, exchangeImbalances, speedStats, whaleScore, divergence, resetCvd } =
    useWhaleTransactions(minUsd, selectedCoin);

  // Sound alerts for whale trades
  useWhaleSound([...events, ...liquidations], soundEnabled);

  const cachedRef = useRef<Record<Tab, WhaleEvent[]>>({ spot: [], futures: [], liquidations: [], analytics: [] });

  const allTransactions = useMemo(() => {
    if (tab === 'liquidations') {
      return liquidations.filter(tx => tx.coin === selectedCoin).slice(0, 100);
    }

    const exchanges = tab === 'spot' ? SPOT_EXCHANGES : FUTURES_EXCHANGES;
    const fresh = events
      .filter((tx) => tx.coin === selectedCoin && exchanges.includes(tx.exchange))
      .slice(0, 25);

    // Merge fresh into cache: prepend new items, keep up to 25 total
    const prev = cachedRef.current[tab] || [];
    const existingIds = new Set(fresh.map(t => t.id));
    const kept = prev.filter(t => !existingIds.has(t.id));
    const merged = [...fresh, ...kept].slice(0, 25);

    cachedRef.current[tab] = merged;
    return merged;
  }, [events, liquidations, tab, selectedCoin]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'spot', label: 'Spot' },
    { key: 'futures', label: 'Futures' },
    { key: 'liquidations', label: 'Liquidations' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Header
        isConnected={isConnected}
        currentPrice={currentPrice}
        totalMonitored={totalMonitored}
        coinSymbol={selectedCoin}
      />

      {error && (
        <div className="px-4 py-1.5 bg-sell-muted text-sell text-xs text-center font-medium">
          {error} — Reconnecting...
        </div>
      )}

      {/* Coin selector + Threshold slider + sound toggle */}
      <div className="flex items-center border-b border-border">
        {/* Coin Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setCoinMenuOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors border-r border-border"
          >
            {selectedCoin}
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${coinMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {coinMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCoinMenuOpen(false)} />
              <div className="absolute top-full left-0 z-50 bg-background border border-border rounded-sm shadow-lg min-w-[120px] py-1">
                {COINS.map(c => (
                  <button
                    key={c.symbol}
                    onClick={() => { setSelectedCoin(c.symbol); setCoinMenuOpen(false); cachedRef.current = { spot: [], futures: [], liquidations: [], analytics: [] }; }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                      c.symbol === selectedCoin
                        ? 'text-buy bg-buy-muted'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <ThresholdSlider value={minUsd} onChange={setMinUsd} />
        <button
          onClick={() => setSoundEnabled((s) => !s)}
          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={soundEnabled ? 'Mute alerts' : 'Enable sound alerts'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

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

      <main className="flex-1 overflow-hidden">
        {tab === 'analytics' ? (
          <div className="flex flex-col h-full">
            <ExchangeImbalanceBar imbalances={exchangeImbalances} />
            <WhaleScoreCard score={whaleScore} />
            <NetFlowIndicator volumeStats={volumeStats} divergence={divergence} />
            <div className="flex-1 min-h-0">
              <CvdChart data={cvdHistory} fill onReset={resetCvd} />
            </div>
            <SpeedMeter stats={speedStats} />
            <VolumeBar stats={volumeStats} />
          </div>
        ) : allTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 text-muted-foreground">
              <Radar className="h-8 w-8 mx-auto animate-pulse opacity-40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {tab === 'liquidations'
                    ? `Scanning for ${selectedCoin} liquidation events`
                    : `Scanning for ${selectedCoin} ${tab === 'spot' ? 'spot' : 'futures'} whale trades`}
                </p>
                <p className="text-xs opacity-60">
                  Min threshold: ${minUsd.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto h-full scrollbar-thin">
            <div className="space-y-1 p-3 sm:p-4">
            {allTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                labelOverride={
                  tab === 'futures' && tx.type !== 'liquidation'
                    ? tx.type === 'buy'
                      ? 'long'
                      : 'short'
                    : tab === 'liquidations'
                    ? tx.direction === 'long'
                      ? 'LONG LIQ'
                      : 'SHORT LIQ'
                    : undefined
                }
              />
            ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
