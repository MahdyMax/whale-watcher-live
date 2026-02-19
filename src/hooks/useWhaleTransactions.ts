// BTC Whale Tracker - Multi-exchange real-time WebSocket hook v2
import { useState, useEffect, useRef, useCallback } from 'react';

export interface WhaleTransaction {
  id: string;
  type: 'buy' | 'sell';
  btcAmount: number;
  usdValue: number;
  pricePerBtc: number;
  exchange: string;
  timestamp: Date;
}

const MIN_USD = 1;
const MAX_USD = 10_000_000;
const MAX_TRANSACTIONS = 100;
const BATCH_INTERVAL = 80; // flush rapidly for one-by-one appearance

// --- Exchange WebSocket configs ---

interface ExchangeConfig {
  name: string;
  url: string;
  onOpen?: (ws: WebSocket) => void;
  parseTrade: (data: any) => { price: number; quantity: number; isSell: boolean; tradeId: string; timestamp: number } | null;
}

const EXCHANGES: ExchangeConfig[] = [
  // Binance Spot
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
  // Binance Futures
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
  // Bybit Spot
  {
    name: 'Bybit',
    url: 'wss://stream.bybit.com/v5/public/spot',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT'] }));
    },
    parseTrade: (raw) => {
      if (raw.topic !== 'publicTrade.BTCUSDT' || !raw.data?.length) return null;
      const d = raw.data[0];
      return {
        price: parseFloat(d.p),
        quantity: parseFloat(d.v),
        isSell: d.S === 'Sell',
        tradeId: d.i,
        timestamp: d.T,
      };
    },
  },
  // Bybit Linear (Futures/Leverage)
  {
    name: 'Bybit Futures',
    url: 'wss://stream.bybit.com/v5/public/linear',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT'] }));
    },
    parseTrade: (raw) => {
      if (raw.topic !== 'publicTrade.BTCUSDT' || !raw.data?.length) return null;
      const d = raw.data[0];
      return {
        price: parseFloat(d.p),
        quantity: parseFloat(d.v),
        isSell: d.S === 'Sell',
        tradeId: d.i,
        timestamp: d.T,
      };
    },
  },
];

export function useWhaleTransactions() {
  const [buys, setBuys] = useState<WhaleTransaction[]>([]);
  const [sells, setSells] = useState<WhaleTransaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [totalMonitored, setTotalMonitored] = useState(0);

  const wsRefs = useRef<(WebSocket | null)[]>([]);
  const reconnectRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const buyBufferRef = useRef<WhaleTransaction[]>([]);
  const sellBufferRef = useRef<WhaleTransaction[]>([]);
  const flushRef = useRef<ReturnType<typeof setInterval>>();
  const monitorCountRef = useRef(0);
  const connectedCountRef = useRef(0);

  // Flush buffered transactions into state periodically
  useEffect(() => {
    flushRef.current = setInterval(() => {
      if (buyBufferRef.current.length > 0) {
        const newBuys = buyBufferRef.current;
        buyBufferRef.current = [];
        setBuys((prev) => [...newBuys, ...prev].slice(0, MAX_TRANSACTIONS));
      }
      if (sellBufferRef.current.length > 0) {
        const newSells = sellBufferRef.current;
        sellBufferRef.current = [];
        setSells((prev) => [...newSells, ...prev].slice(0, MAX_TRANSACTIONS));
      }
      setTotalMonitored(monitorCountRef.current);
    }, BATCH_INTERVAL);

    return () => {
      if (flushRef.current) clearInterval(flushRef.current);
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

          const { price, quantity, isSell, tradeId, timestamp } = trade;
          const usdValue = price * quantity;

          setCurrentPrice(price);
          monitorCountRef.current += 1;

          if (usdValue >= MIN_USD && usdValue <= MAX_USD) {
            const tx: WhaleTransaction = {
              id: `${config.name}-${tradeId}-${timestamp}`,
              type: isSell ? 'sell' : 'buy',
              btcAmount: quantity,
              usdValue,
              pricePerBtc: price,
              exchange: config.name,
              timestamp: new Date(timestamp),
            };
            if (tx.type === 'buy') {
              buyBufferRef.current.push(tx);
            } else {
              sellBufferRef.current.push(tx);
            }
          }
        } catch (e) {
          console.error(`Parse error (${config.name}):`, e);
        }
      };

      ws.onerror = () => {
        setError(`${config.name} connection error`);
      };

      ws.onclose = () => {
        connectedCountRef.current = Math.max(0, connectedCountRef.current - 1);
        if (connectedCountRef.current === 0) setIsConnected(false);
        reconnectRefs.current[index] = setTimeout(() => connectExchange(config, index), 3000);
      };
    } catch {
      reconnectRefs.current[index] = setTimeout(() => connectExchange(config, index), 3000);
    }
  }, []);

  useEffect(() => {
    wsRefs.current = new Array(EXCHANGES.length).fill(null);
    reconnectRefs.current = [];
    EXCHANGES.forEach((cfg, i) => connectExchange(cfg, i));

    return () => {
      wsRefs.current.forEach((ws) => ws?.close());
      reconnectRefs.current.forEach((t) => clearTimeout(t));
    };
  }, [connectExchange]);

  return { buys, sells, isConnected, error, currentPrice, totalMonitored };
}
