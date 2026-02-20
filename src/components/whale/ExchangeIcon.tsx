import { memo } from 'react';

const SHORT_NAME: Record<string, string> = {
  'Binance Futures': 'Binance',
  'Bybit Futures': 'Bybit',
  'OKX Futures': 'OKX',
};

interface ExchangeIconProps {
  exchange: string;
}

export const ExchangeIcon = memo(function ExchangeIcon({ exchange }: ExchangeIconProps) {
  const name = SHORT_NAME[exchange] || exchange;

  return (
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
      {name}
    </span>
  );
});
