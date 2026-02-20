import { memo } from 'react';

const ICONS: Record<string, string> = {
  Binance: 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/binance.svg',
  'Binance Futures': 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/binance.svg',
  Bybit: 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/bybit.svg',
  'Bybit Futures': 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/bybit.svg',
  Coinbase: 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/coinbase.svg',
  OKX: 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/okx.svg',
  'OKX Futures': 'https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/exchanges/okx.svg',
};

// Short labels for futures variants
const SHORT: Record<string, string> = {
  'Binance Futures': 'F',
  'Bybit Futures': 'F',
  'OKX Futures': 'F',
};

interface ExchangeIconProps {
  exchange: string;
  size?: number;
}

export const ExchangeIcon = memo(function ExchangeIcon({ exchange, size = 14 }: ExchangeIconProps) {
  const src = ICONS[exchange];
  const suffix = SHORT[exchange];

  if (!src) {
    return (
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {exchange}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5" title={exchange}>
      <img
        src={src}
        alt={exchange}
        width={size}
        height={size}
        className="rounded-sm"
        style={{ minWidth: size }}
      />
      {suffix && (
        <span className="text-muted-foreground text-[9px] font-bold leading-none">{suffix}</span>
      )}
    </span>
  );
});
