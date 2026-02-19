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
const MIN_USD = 1_000_000;
const MAX_USD = 10_000_000;
const MAX_TRANSACTIONS = 50;

export function useWhaleTransactions() {
  const [buys, setBuys] = useState<WhaleTransaction[]>([]);
  const [sells, setSells] = useState<WhaleTransaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [totalMonitored, setTotalMonitored] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const addTransaction = useCallback((tx: WhaleTransaction) => {
    if (tx.type === 'buy') {
      setBuys(prev => [tx, ...prev].slice(0, MAX_TRANSACTIONS));
    } else {
      setSells(prev => [tx, ...prev].slice(0, MAX_TRANSACTIONS));
    }
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
          setTotalMonitored(prev => prev + 1);

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
            addTransaction(tx);
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
    } catch (e) {
      setError('Failed to connect');
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [addTransaction]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return { buys, sells, isConnected, error, currentPrice, totalMonitored };
}
