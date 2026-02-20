// BTC Whale Tracker - Multi-exchange real-time WebSocket hook v3
// Features: Burst aggregation, configurable threshold, volume tracking, liquidation feed
import { useState, useEffect, useRef, useCallback } from 'react';

export interface WhaleEvent {
  id: string;
  type: 'buy' | 'sell' | 'liquidation';
  btcAmount: number;
  usdValue: number;
  pricePerBtc: number;
  exchange: string;
  timestamp: Date;
  tradeCount: number; // how many raw trades were aggregated
}

export interface VolumeStats {
  buy1m: number;
  sell1m: number;
  buy5m: number;
  sell5m: number;
  netDelta1m: number;
  netDelta5m: number;
  spotNet5m: number;
  futuresNet5m: number;
}

const DEFAULT_MIN_USD = 50_000;
const AGGREGATION_WINDOW = 500; // ms - burst aggregation window
const VOLUME_WINDOW_1M = 60_000;
const VOLUME_WINDOW_5M = 300_000;

// --- Raw trade for internal tracking ---
interface RawTrade {
  price: number;
  quantity: number;
  usdValue: number;
  isSell: boolean;
  exchange: string;
  timestamp: number;
}

// --- Exchange WebSocket configs ---
interface ExchangeConfig {
  name: string;
  url: string;
  onOpen?: (ws: WebSocket) => void;
  parseTrade: (data: any) => { price: number; quantity: number; isSell: boolean; tradeId: string; timestamp: number } | null;
}

interface LiquidationConfig {
  name: string;
  url: string;
  onOpen?: (ws: WebSocket) => void;
  parseLiquidation: (data: any) => { price: number; quantity: number; side: 'long' | 'short'; timestamp: number } | null;
}

const EXCHANGES: ExchangeConfig[] = [
  {
    name: 'Binance',
    url: 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade',
    parseTrade: (data) => ({
      price: parseFloat(data.p),
      quantity: parseFloat(data.q),
      isSell: data.m,
      tradeId: `${data.a}`,
      timestamp: data.T,
    }),
  },
  {
    name: 'Binance Futures',
    url: 'wss://fstream.binance.com/ws/btcusdt@aggTrade',
    parseTrade: (data) => ({
      price: parseFloat(data.p),
      quantity: parseFloat(data.q),
      isSell: data.m,
      tradeId: `${data.a}`,
      timestamp: data.T,
    }),
  },
  {
    name: 'Bybit',
    url: 'wss://stream.bybit.com/v5/public/spot',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT'] }));
    },
    parseTrade: (raw) => {
      if (raw.topic !== 'publicTrade.BTCUSDT' || !raw.data?.length) return null;
      const d = raw.data[0];
      return { price: parseFloat(d.p), quantity: parseFloat(d.v), isSell: d.S === 'Sell', tradeId: d.i, timestamp: d.T };
    },
  },
  {
    name: 'Bybit Futures',
    url: 'wss://stream.bybit.com/v5/public/linear',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT'] }));
    },
    parseTrade: (raw) => {
      if (raw.topic !== 'publicTrade.BTCUSDT' || !raw.data?.length) return null;
      const d = raw.data[0];
      return { price: parseFloat(d.p), quantity: parseFloat(d.v), isSell: d.S === 'Sell', tradeId: d.i, timestamp: d.T };
    },
  },
];

const LIQUIDATION_FEEDS: LiquidationConfig[] = [
  {
    name: 'Binance Futures',
    url: 'wss://fstream.binance.com/ws/btcusdt@forceOrder',
    parseLiquidation: (data) => {
      const o = data?.o;
      if (!o) return null;
      return {
        price: parseFloat(o.p),
        quantity: parseFloat(o.q),
        side: o.S === 'SELL' ? 'long' : 'short', // liquidated side is opposite
        timestamp: o.T,
      };
    },
  },
  {
    name: 'Bybit Futures',
    url: 'wss://stream.bybit.com/v5/public/linear',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['liquidation.BTCUSDT'] }));
    },
    parseLiquidation: (raw) => {
      if (raw.topic !== 'liquidation.BTCUSDT' || !raw.data) return null;
      const d = raw.data;
      return {
        price: parseFloat(d.price),
        quantity: parseFloat(d.size),
        side: d.side === 'Sell' ? 'long' : 'short',
        timestamp: d.updatedTime,
      };
    },
  },
];

export function useWhaleTransactions(minUsd: number = DEFAULT_MIN_USD) {
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [liquidations, setLiquidations] = useState<WhaleEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [totalMonitored, setTotalMonitored] = useState(0);
  const [volumeStats, setVolumeStats] = useState<VolumeStats>({
    buy1m: 0, sell1m: 0, buy5m: 0, sell5m: 0, netDelta1m: 0, netDelta5m: 0, spotNet5m: 0, futuresNet5m: 0,
  });

  const wsRefs = useRef<(WebSocket | null)[]>([]);
  const liqWsRefs = useRef<(WebSocket | null)[]>([]);
  const reconnectRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tradeBufferRef = useRef<RawTrade[]>([]);
  const liqBufferRef = useRef<WhaleEvent[]>([]);
  const flushRef = useRef<ReturnType<typeof setInterval>>();
  const volumeRef = useRef<ReturnType<typeof setInterval>>();
  const monitorCountRef = useRef(0);
  const connectedCountRef = useRef(0);
  const minUsdRef = useRef(minUsd);
  // Rolling volume window - store all trades for volume calc
  const volumeTradesRef = useRef<{ timestamp: number; usdValue: number; isSell: boolean; exchange: string }[]>([]);

  // Keep minUsd ref in sync
  useEffect(() => {
    minUsdRef.current = minUsd;
  }, [minUsd]);

  // Burst aggregation: group buffered trades by direction+exchange, emit whale events
  useEffect(() => {
    flushRef.current = setInterval(() => {
      const buffer = tradeBufferRef.current;
      tradeBufferRef.current = [];

      if (buffer.length > 0) {
        // Group by direction + exchange
        const groups = new Map<string, RawTrade[]>();
        for (const t of buffer) {
          const key = `${t.isSell ? 'sell' : 'buy'}|${t.exchange}`;
          const arr = groups.get(key) || [];
          arr.push(t);
          groups.set(key, arr);
        }

        const newEvents: WhaleEvent[] = [];
        for (const [key, trades] of groups) {
          const totalUsd = trades.reduce((s, t) => s + t.usdValue, 0);
          const totalBtc = trades.reduce((s, t) => s + t.quantity, 0);
          const avgPrice = totalUsd / totalBtc;
          const [type, exchange] = key.split('|');

          if (totalUsd >= minUsdRef.current) {
            newEvents.push({
              id: `${exchange}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: type as 'buy' | 'sell',
              btcAmount: totalBtc,
              usdValue: totalUsd,
              pricePerBtc: avgPrice,
              exchange,
              timestamp: new Date(trades[trades.length - 1].timestamp),
              tradeCount: trades.length,
            });
          }
        }

        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents, ...prev].slice(0, 100));
        }
      }

      // Flush liquidations
      if (liqBufferRef.current.length > 0) {
        const newLiqs = liqBufferRef.current;
        liqBufferRef.current = [];
        setLiquidations((prev) => [...newLiqs, ...prev].slice(0, 100));
      }

      setTotalMonitored(monitorCountRef.current);
    }, AGGREGATION_WINDOW);

    return () => {
      if (flushRef.current) clearInterval(flushRef.current);
    };
  }, []);

  // Volume stats computation - every second
  useEffect(() => {
    volumeRef.current = setInterval(() => {
      const now = Date.now();
      // Prune old trades
      volumeTradesRef.current = volumeTradesRef.current.filter(
        (t) => now - t.timestamp < VOLUME_WINDOW_5M
      );

      const trades = volumeTradesRef.current;
      let buy1m = 0, sell1m = 0, buy5m = 0, sell5m = 0;
      let spotBuy5m = 0, spotSell5m = 0, futBuy5m = 0, futSell5m = 0;

      for (const t of trades) {
        const age = now - t.timestamp;
        const isFutures = t.exchange.includes('Futures');
        if (t.isSell) {
          sell5m += t.usdValue;
          if (age < VOLUME_WINDOW_1M) sell1m += t.usdValue;
          if (isFutures) futSell5m += t.usdValue; else spotSell5m += t.usdValue;
        } else {
          buy5m += t.usdValue;
          if (age < VOLUME_WINDOW_1M) buy1m += t.usdValue;
          if (isFutures) futBuy5m += t.usdValue; else spotBuy5m += t.usdValue;
        }
      }

      setVolumeStats({
        buy1m, sell1m, buy5m, sell5m,
        netDelta1m: buy1m - sell1m,
        netDelta5m: buy5m - sell5m,
        spotNet5m: spotBuy5m - spotSell5m,
        futuresNet5m: futBuy5m - futSell5m,
      });
    }, 1000);

    return () => {
      if (volumeRef.current) clearInterval(volumeRef.current);
    };
  }, []);

  const connectExchange = useCallback((config: ExchangeConfig, index: number) => {
    if (wsRefs.current[index]?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(config.url);
      wsRefs.current[index] = ws;

      ws.onopen = () => {
        connectedCountRef.current += 1;
        setIsConnected(true);
        setError(null);
        config.onOpen?.(ws);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const trade = config.parseTrade(raw);
          if (!trade) return;

          const { price, quantity, isSell, timestamp } = trade;
          const usdValue = price * quantity;

          setCurrentPrice(price);
          monitorCountRef.current += 1;

          // Track all trades for volume
          volumeTradesRef.current.push({ timestamp, usdValue, isSell, exchange: config.name });

          // Buffer for burst aggregation (all trades, threshold applied on flush)
          tradeBufferRef.current.push({
            price, quantity, usdValue, isSell,
            exchange: config.name, timestamp,
          });
        } catch (e) {
          console.error(`Parse error (${config.name}):`, e);
        }
      };

      ws.onerror = () => setError(`${config.name} connection error`);

      ws.onclose = () => {
        connectedCountRef.current = Math.max(0, connectedCountRef.current - 1);
        if (connectedCountRef.current === 0) setIsConnected(false);
        reconnectRefs.current[index] = setTimeout(() => connectExchange(config, index), 3000);
      };
    } catch {
      reconnectRefs.current[index] = setTimeout(() => connectExchange(config, index), 3000);
    }
  }, []);

  const connectLiquidation = useCallback((config: LiquidationConfig, index: number) => {
    const wsIndex = EXCHANGES.length + index;
    if (liqWsRefs.current[index]?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(config.url);
      liqWsRefs.current[index] = ws;

      ws.onopen = () => {
        connectedCountRef.current += 1;
        setIsConnected(true);
        config.onOpen?.(ws);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const liq = config.parseLiquidation(raw);
          if (!liq) return;

          const usdValue = liq.price * liq.quantity;
          if (usdValue < minUsdRef.current) return;

          liqBufferRef.current.push({
            id: `liq-${config.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'liquidation',
            btcAmount: liq.quantity,
            usdValue,
            pricePerBtc: liq.price,
            exchange: config.name,
            timestamp: new Date(liq.timestamp),
            tradeCount: 1,
          });
        } catch (e) {
          console.error(`Liquidation parse error (${config.name}):`, e);
        }
      };

      ws.onerror = () => setError(`${config.name} liquidation error`);

      ws.onclose = () => {
        connectedCountRef.current = Math.max(0, connectedCountRef.current - 1);
        if (connectedCountRef.current === 0) setIsConnected(false);
        reconnectRefs.current[wsIndex] = setTimeout(() => connectLiquidation(config, index), 3000);
      };
    } catch {
      reconnectRefs.current[wsIndex] = setTimeout(() => connectLiquidation(config, index), 3000);
    }
  }, []);

  useEffect(() => {
    wsRefs.current = new Array(EXCHANGES.length).fill(null);
    liqWsRefs.current = new Array(LIQUIDATION_FEEDS.length).fill(null);
    reconnectRefs.current = [];
    EXCHANGES.forEach((cfg, i) => connectExchange(cfg, i));
    LIQUIDATION_FEEDS.forEach((cfg, i) => connectLiquidation(cfg, i));

    return () => {
      wsRefs.current.forEach((ws) => ws?.close());
      liqWsRefs.current.forEach((ws) => ws?.close());
      reconnectRefs.current.forEach((t) => clearTimeout(t));
    };
  }, [connectExchange, connectLiquidation]);

  return { events, liquidations, isConnected, error, currentPrice, totalMonitored, volumeStats };
}
