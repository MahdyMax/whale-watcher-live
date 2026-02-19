import { Header } from '@/components/whale/Header';
import { TransactionCard } from '@/components/whale/TransactionCard';
import { useWhaleTransactions } from '@/hooks/useWhaleTransactions';
import { Radar } from 'lucide-react';

// Force clean re-mount after hook changes
const Index = () => {
  const { buys, sells, isConnected, error, currentPrice, totalMonitored } =
    useWhaleTransactions();

  // Merge, sort descending, and keep only what fits the screen
  const allTransactions = [...buys, ...sells]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 25);

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

      <main className="flex-1 overflow-hidden p-3 sm:p-4">
        {allTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 text-muted-foreground">
              <Radar className="h-8 w-8 mx-auto animate-pulse opacity-40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Scanning for whale trades</p>
                <p className="text-xs opacity-60">$1 – $10M threshold</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-1">
            {allTransactions.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
