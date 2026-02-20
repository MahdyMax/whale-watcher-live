import { memo } from 'react';

// Minimal inline SVG icons for each exchange, sized to match text
const BinanceIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1.5L7.05 6.45l1.83 1.83L12 5.16l3.12 3.12 1.83-1.83L12 1.5zM4.5 9l-3 3 3 3 1.83-1.83L4.5 11.34V9zm15 0v2.34l-1.83 1.83L19.5 15l3-3-3-3zM12 8.34L8.34 12 12 15.66 15.66 12 12 8.34zM12 18.84l-3.12-3.12-1.83 1.83L12 22.5l4.95-4.95-1.83-1.83L12 18.84z"/>
  </svg>
);

const BybitIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4h6v6H4V4zm0 10h6v6H4v-6zm10-10h6v6h-6V4zm0 10h6v6h-6v-6z"/>
  </svg>
);

const CoinbaseIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <path d="M14.5 9.5h-3a2 2 0 000 4h1a2 2 0 010 4h-3M12 8v1.5M12 17.5V19"/>
  </svg>
);

const OKXIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ICON_MAP: Record<string, React.FC<{ size: number }>> = {
  Binance: BinanceIcon,
  'Binance Futures': BinanceIcon,
  Bybit: BybitIcon,
  'Bybit Futures': BybitIcon,
  Coinbase: CoinbaseIcon,
  OKX: OKXIcon,
  'OKX Futures': OKXIcon,
};

interface ExchangeIconProps {
  exchange: string;
}

export const ExchangeIcon = memo(function ExchangeIcon({ exchange }: ExchangeIconProps) {
  const IconComp = ICON_MAP[exchange];

  if (!IconComp) {
    return (
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {exchange}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-muted-foreground" title={exchange}>
      <IconComp size={10} />
    </span>
  );
});
