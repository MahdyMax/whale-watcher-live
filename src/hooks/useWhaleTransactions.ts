// BTC Whale Tracker - Real-time WebSocket hook
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

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade';
const MIN_USD = 1;
const MAX_USD = 10_000_000;
const MAX_TRANSACTIONS = 25;
const BATCH_INTERVAL = 500; // flush every 500ms

export function useWhaleTransactions() {
  const [buys, setBuys] = useState<WhaleTransaction[]>([]);
  const [sells, setSells] = useState<WhaleTransaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [totalMonitored, setTotalMonitored] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const buyBufferRef = useRef<WhaleTransaction[]>([]);
  const sellBufferRef = useRef<WhaleTransaction[]>([]);
  const flushRef = useRef<ReturnType<typeof setInterval>>();
  const monitorCountRef = useRef(0);

  // Flush buffered transactions into state periodically
  useEffect(() => {
    flushRef.current = setInterval(() => {
      if (buyBufferRef.current.length > 0) {
        const newBuys = buyBufferRef.current;
        buyBufferRef.current = [];
        setBuys(prev => [...newBuys, ...prev].slice(0, MAX_TRANSACTIONS));
      }
      if (sellBufferRef.current.length > 0) {
        const newSells = sellBufferRef.current;
        sellBufferRef.current = [];
        setSells(prev => [...newSells, ...prev].slice(0, MAX_TRANSACTIONS));
      }
      setTotalMonitored(monitorCountRef.current);
    }, BATCH_INTERVAL);

    return () => {
      if (flushRef.current) clearInterval(flushRef.current);
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(BINANCE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const price = parseFloat(data.p);
          const quantity = parseFloat(data.q);
          const usdValue = price * quantity;

          setCurrentPrice(price);
          monitorCountRef.current += 1;

          if (usdValue >= MIN_USD && usdValue <= MAX_USD) {
            const tx: WhaleTransaction = {
              id: `${data.a}-${data.T}`,
              type: data.m ? 'sell' : 'buy',
              btcAmount: quantity,
              usdValue,
              pricePerBtc: price,
              exchange: 'Binance',
              timestamp: new Date(data.T),
            };
            if (tx.type === 'buy') {
              buyBufferRef.current.push(tx);
            } else {
              sellBufferRef.current.push(tx);
            }
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    } catch {
      setError('Failed to connect');
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return { buys, sells, isConnected, error, currentPrice, totalMonitored };
}
