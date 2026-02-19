import { Header } from '@/components/whale/Header';
import { TransactionColumn } from '@/components/whale/TransactionColumn';
import { useWhaleTransactions } from '@/hooks/useWhaleTransactions';

const Index = () => {
  const { buys, sells, isConnected, error, currentPrice, totalMonitored } =
    useWhaleTransactions();

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

      <main className="flex-1 flex min-h-0 divide-x divide-border">
        <TransactionColumn title="Buys" transactions={buys} type="buy" />
        <TransactionColumn title="Sells" transactions={sells} type="sell" />
      </main>
    </div>
  );
};

export default Index;
