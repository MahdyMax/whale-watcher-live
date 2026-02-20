// BTC Whale Tracker - Multi-exchange real-time WebSocket hook v4
// Features: Burst aggregation (trades + liquidations), configurable threshold, volume tracking, DB persistence
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WhaleEvent {
  id: string;
  type: 'buy' | 'sell' | 'liquidation';
  direction?: 'long' | 'short'; // for liquidations
  btcAmount: number;
  usdValue: number;
  pricePerBtc: number;
  exchange: string;
  timestamp: Date;
  tradeCount: number;
  isMega?: boolean; // > $2M liquidation
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

export interface CvdPoint {
  time: string;
  cvd: number;
}

export interface ExchangeImbalance {
  exchange: string;
  buyVol: number;
  sellVol: number;
  net: number;
  label: 'Heavy Buying' | 'Heavy Selling' | 'Neutral';
}

export interface SpeedStats {
  tradesPerSec: number;
  volumePerSec: number;
  intensity: 'low' | 'medium' | 'high';
}

export interface WhaleScore {
  score: number;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

const DEFAULT_MIN_USD = 50_000;
const TRADE_AGGREGATION_WINDOW = 500; // ms
const LIQ_AGGREGATION_WINDOW = 50; // ms - micro-trade capture (was 200ms)
const VOLUME_WINDOW_1M = 60_000;
const VOLUME_WINDOW_5M = 300_000;
const MEGA_THRESHOLD = 2_000_000; // $2M
const MAX_TRADE_BUFFER = 200;
const MAX_LIQ_BUFFER = 1000; // larger buffer for liquidation cascades

// --- Raw types ---
interface RawTrade {
  price: number;
  quantity: number;
  usdValue: number;
  isSell: boolean;
  exchange: string;
  timestamp: number;
}

interface RawLiquidation {
  price: number;
  quantity: number;
  usdValue: number;
  side: 'long' | 'short';
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
  parseLiquidation: (data: any) => { price: number; usdValue: number; quantity: number; side: 'long' | 'short'; timestamp: number } | null;
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
  {
    name: 'Coinbase',
    url: 'wss://advanced-trade-ws.coinbase.com',
    onOpen: (ws) => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channel: 'market_trades',
      }));
    },
    parseTrade: (raw) => {
      if (raw.channel !== 'market_trades' || !raw.events?.length) return null;
      const evt = raw.events[0];
      if (!evt.trades?.length) return null;
      const t = evt.trades[0];
      return {
        price: parseFloat(t.price),
        quantity: parseFloat(t.size),
        isSell: t.side === 'SELL',
        tradeId: t.trade_id,
        timestamp: new Date(t.time).getTime(),
      };
    },
  },
  {
    name: 'OKX',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'trades', instId: 'BTC-USDT' }],
      }));
    },
    parseTrade: (raw) => {
      if (raw.arg?.channel !== 'trades' || !raw.data?.length) return null;
      const d = raw.data[0];
      return {
        price: parseFloat(d.px),
        quantity: parseFloat(d.sz),
        isSell: d.side === 'sell',
        tradeId: d.tradeId,
        timestamp: parseInt(d.ts),
      };
    },
  },
  {
    name: 'OKX Futures',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'trades', instId: 'BTC-USDT-SWAP' }],
      }));
    },
    parseTrade: (raw) => {
      if (raw.arg?.channel !== 'trades' || !raw.data?.length) return null;
      const d = raw.data[0];
      return {
        price: parseFloat(d.px),
        quantity: parseFloat(d.sz),
        isSell: d.side === 'sell',
        tradeId: d.tradeId,
        timestamp: parseInt(d.ts),
      };
    },
  },
];

// OKX contract multiplier — fetched dynamically, fallback to 0.01 BTC
let okxCtVal = 0.01;
let okxCtValCcy: 'BTC' | 'USDT' = 'BTC';

// Fetch OKX contract spec once on load
(async () => {
  try {
    const res = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=BTC-USDT-SWAP');
    const json = await res.json();
    const inst = json?.data?.[0];
    if (inst) {
      okxCtVal = parseFloat(inst.ctVal) || 0.01;
      okxCtValCcy = inst.ctValCcy === 'USDT' ? 'USDT' : 'BTC';
      console.log(`[OKX] Contract size: ${okxCtVal} ${okxCtValCcy}`);
    }
  } catch (e) {
    console.warn('[OKX] Failed to fetch contract info, using fallback 0.01 BTC', e);
  }
})();

const LIQUIDATION_FEEDS: LiquidationConfig[] = [
  {
    name: 'Binance',
    url: 'wss://fstream.binance.com/ws/btcusdt@forceOrder',
    parseLiquidation: (data) => {
      const o = data?.o;
      if (!o) return null;
      const price = parseFloat(o.ap || o.p);
      const quantity = parseFloat(o.q);
      if (isNaN(price) || isNaN(quantity)) return null;
      const usdValue = quantity * price;
      if (!isFinite(usdValue) || usdValue <= 0) return null;
      return {
        price,
        quantity,
        usdValue,
        side: o.S === 'SELL' ? 'long' as const : 'short' as const,
        timestamp: Number(o.T),
      };
    },
  },
  {
    name: 'Bybit',
    url: 'wss://stream.bybit.com/v5/public/linear',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['liquidation.BTCUSDT'] }));
    },
    parseLiquidation: (raw) => {
      if (raw.topic !== 'liquidation.BTCUSDT' || !raw.data) return null;
      const d = raw.data;
      const price = parseFloat(d.price);
      const size = parseFloat(d.size);
      if (isNaN(price) || isNaN(size)) return null;
      // Bybit USDT linear: size is already in USD (1 contract = 1 USD)
      const usdValue = size;
      const quantity = price > 0 ? usdValue / price : 0; // derive BTC amount
      if (!isFinite(usdValue) || usdValue <= 0) return null;
      return {
        price,
        quantity,
        usdValue,
        side: d.side === 'Sell' ? 'long' as const : 'short' as const,
        timestamp: Number(d.updatedTime),
      };
    },
  },
  {
    name: 'OKX',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'liquidation-orders', instType: 'SWAP', instId: 'BTC-USDT-SWAP' }],
      }));
    },
    parseLiquidation: (raw) => {
      if (raw.arg?.channel !== 'liquidation-orders' || !raw.data?.length) return null;
      const d = raw.data[0];
      if (!d.instId?.startsWith('BTC-')) return null;
      const details = d.details?.[0];
      if (!details) return null;
      const price = parseFloat(details.bkPx);
      const sz = parseFloat(details.sz);
      const timestamp = Number(details.ts || d.ts);
      if (isNaN(price) || isNaN(sz) || isNaN(timestamp)) return null;
      // Dynamic contract multiplier
      let usdValue: number;
      let quantity: number;
      if (okxCtValCcy === 'BTC') {
        quantity = sz * okxCtVal;
        usdValue = quantity * price;
      } else {
        usdValue = sz * okxCtVal;
        quantity = price > 0 ? usdValue / price : 0;
      }
      if (!isFinite(usdValue) || usdValue <= 0) return null;
      return {
        price,
        quantity,
        usdValue,
        side: details.side === 'sell' ? 'long' as const : 'short' as const,
        timestamp,
      };
    },
  },
];

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
function getBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

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
  const [cvdHistory, setCvdHistory] = useState<CvdPoint[]>([]);
  const [exchangeImbalances, setExchangeImbalances] = useState<ExchangeImbalance[]>([]);
  const [speedStats, setSpeedStats] = useState<SpeedStats>({ tradesPerSec: 0, volumePerSec: 0, intensity: 'low' });
  const [whaleScore, setWhaleScore] = useState<WhaleScore>({ score: 50, sentiment: 'Neutral' });
  const cvdAccumRef = useRef(0);
  const cvdLastTsRef = useRef(0);

  const wsRefs = useRef<(WebSocket | null)[]>([]);
  const liqWsRefs = useRef<(WebSocket | null)[]>([]);
  const reconnectRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reconnectAttemptsRef = useRef<number[]>([]); // for exponential backoff
  const tradeBufferRef = useRef<RawTrade[]>([]);
  const liqRawBufferRef = useRef<RawLiquidation[]>([]); // raw liquidations for aggregation
  const flushRef = useRef<ReturnType<typeof setInterval>>();
  const liqFlushRef = useRef<ReturnType<typeof setInterval>>();
  const volumeRef = useRef<ReturnType<typeof setInterval>>();
  const monitorCountRef = useRef(0);
  const connectedCountRef = useRef(0);
  const minUsdRef = useRef(minUsd);
  const volumeTradesRef = useRef<{ timestamp: number; usdValue: number; isSell: boolean; exchange: string }[]>([]);

  useEffect(() => {
    minUsdRef.current = minUsd;
  }, [minUsd]);

  // --- Trade burst aggregation (500ms) ---
  useEffect(() => {
    flushRef.current = setInterval(() => {
      const buffer = tradeBufferRef.current;
      tradeBufferRef.current = [];

      if (buffer.length > 0) {
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
          setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_TRADE_BUFFER));
        }
      }

      setTotalMonitored(monitorCountRef.current);
    }, TRADE_AGGREGATION_WINDOW);

    return () => {
      if (flushRef.current) clearInterval(flushRef.current);
    };
  }, []);

  // --- Liquidation burst aggregation (200ms) ---
  // Groups by exchange + direction within 200ms window, merges into single event
  useEffect(() => {
    liqFlushRef.current = setInterval(() => {
      const buffer = liqRawBufferRef.current;
      liqRawBufferRef.current = [];

      if (buffer.length === 0) return;

      // Group by exchange + direction
      const groups = new Map<string, RawLiquidation[]>();
      for (const l of buffer) {
        const key = `${l.exchange}|${l.side}`;
        const arr = groups.get(key) || [];
        arr.push(l);
        groups.set(key, arr);
      }

      const newLiqs: WhaleEvent[] = [];
      for (const [key, liqs] of groups) {
        const totalUsd = liqs.reduce((s, l) => s + l.usdValue, 0);
        const totalBtc = liqs.reduce((s, l) => s + l.quantity, 0);
        const avgPrice = totalUsd / totalBtc;
        const [exchange, side] = key.split('|');

        // No USD filter for liquidations — capture all micro trades
        // Only skip truly invalid values (already filtered in parseLiquidation)

        newLiqs.push({
          id: `liq-${exchange}-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'liquidation',
          direction: side as 'long' | 'short',
          btcAmount: totalBtc,
          usdValue: totalUsd,
          pricePerBtc: avgPrice,
          exchange,
          timestamp: new Date(liqs[liqs.length - 1].timestamp),
          tradeCount: liqs.length,
          isMega: totalUsd >= MEGA_THRESHOLD,
        });
      }

      if (newLiqs.length > 0) {
        console.log(`[LIQ FLUSH] ${newLiqs.length} events:`, newLiqs.map(l => `${l.exchange} ${l.direction} $${Math.round(l.usdValue)}`).join(', '));
        setLiquidations((prev) => [...newLiqs, ...prev].slice(0, MAX_LIQ_BUFFER));

        // Persist to database for historical aggregation
        const rows = newLiqs.map(l => ({
          exchange: l.exchange,
          direction: l.direction || 'long',
          notional_usd: l.usdValue,
          price: l.pricePerBtc,
          quantity: l.btcAmount,
          trade_count: l.tradeCount,
          source_timestamp: l.timestamp.toISOString(),
        }));
        supabase.from('liquidation_events').insert(rows).then(({ error }) => {
          if (error) console.error('[DB] Insert error:', error);
        });
      }
    }, LIQ_AGGREGATION_WINDOW);

    return () => {
      if (liqFlushRef.current) clearInterval(liqFlushRef.current);
    };
  }, []);

  // Volume stats computation - every second
  useEffect(() => {
    volumeRef.current = setInterval(() => {
      const now = Date.now();
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

      // CVD
      const cvdCursor = cvdLastTsRef.current;
      let maxTs = cvdCursor;
      for (const t of trades) {
        if (t.timestamp > cvdCursor) {
          cvdAccumRef.current += t.isSell ? -t.usdValue : t.usdValue;
          if (t.timestamp > maxTs) maxTs = t.timestamp;
        }
      }
      cvdLastTsRef.current = maxTs;
      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      setCvdHistory(prev => [...prev.slice(-59), { time: timeStr, cvd: cvdAccumRef.current }]);

      // Exchange Imbalance (1m)
      const exchMap = new Map<string, { buy: number; sell: number }>();
      for (const t of trades) {
        if (now - t.timestamp > VOLUME_WINDOW_1M) continue;
        const base = t.exchange.replace(' Futures', '');
        const entry = exchMap.get(base) || { buy: 0, sell: 0 };
        if (t.isSell) entry.sell += t.usdValue; else entry.buy += t.usdValue;
        exchMap.set(base, entry);
      }
      const imbalances: ExchangeImbalance[] = [];
      for (const [exchange, { buy: b, sell: s }] of exchMap) {
        const net = b - s;
        const total = b + s;
        const ratio = total > 0 ? Math.abs(net) / total : 0;
        imbalances.push({
          exchange, buyVol: b, sellVol: s, net,
          label: ratio < 0.15 ? 'Neutral' : net > 0 ? 'Heavy Buying' : 'Heavy Selling',
        });
      }
      setExchangeImbalances(imbalances);

      // Speed Meter (3s avg)
      const recentWindow = trades.filter(t => now - t.timestamp < 3000);
      const tps = recentWindow.length / 3;
      const vps = recentWindow.reduce((s, t) => s + t.usdValue, 0) / 3;
      setSpeedStats({
        tradesPerSec: Math.round(tps),
        volumePerSec: vps,
        intensity: tps > 50 ? 'high' : tps > 15 ? 'medium' : 'low',
      });

      // Whale Score
      const avgSize5m = (buy5m + sell5m) / Math.max(trades.length, 1);
      const sizeScore = Math.min(avgSize5m / 5000, 1) * 25;
      const imbalanceScore = Math.min(Math.abs(buy5m - sell5m) / Math.max(buy5m + sell5m, 1) * 100, 25);
      const liqBonus = Math.min(recentWindow.filter(t => t.isSell).length * 0.5, 25);
      const burstScore = Math.min(tps / 50 * 25, 25);
      const raw = sizeScore + imbalanceScore + liqBonus + burstScore;
      const score = Math.round(Math.min(Math.max(raw, 0), 100));
      const dir = buy5m - sell5m;
      setWhaleScore({
        score,
        sentiment: Math.abs(dir) / Math.max(buy5m + sell5m, 1) < 0.05 ? 'Neutral' : dir > 0 ? 'Bullish' : 'Bearish',
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
        reconnectAttemptsRef.current[index] = 0; // reset backoff
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

          volumeTradesRef.current.push({ timestamp, usdValue, isSell, exchange: config.name });

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
        const attempt = (reconnectAttemptsRef.current[index] || 0);
        reconnectAttemptsRef.current[index] = attempt + 1;
        reconnectRefs.current[index] = setTimeout(
          () => connectExchange(config, index),
          getBackoff(attempt)
        );
      };
    } catch {
      const attempt = (reconnectAttemptsRef.current[index] || 0);
      reconnectAttemptsRef.current[index] = attempt + 1;
      reconnectRefs.current[index] = setTimeout(
        () => connectExchange(config, index),
        getBackoff(attempt)
      );
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
        reconnectAttemptsRef.current[wsIndex] = 0;
        setIsConnected(true);
        config.onOpen?.(ws);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const liq = config.parseLiquidation(raw);
          if (!liq) return;

          console.log(`[RAW LIQ] ${config.name} ${liq.side} $${Math.round(liq.usdValue)} @ ${Math.round(liq.price)}`);

          // Buffer raw liquidation for burst aggregation
          liqRawBufferRef.current.push({
            price: liq.price,
            quantity: liq.quantity,
            usdValue: liq.usdValue,
            side: liq.side,
            exchange: config.name,
            timestamp: liq.timestamp,
          });
        } catch (e) {
          console.error(`Liquidation parse error (${config.name}):`, e);
        }
      };

      ws.onerror = () => setError(`${config.name} liquidation error`);

      ws.onclose = () => {
        connectedCountRef.current = Math.max(0, connectedCountRef.current - 1);
        if (connectedCountRef.current === 0) setIsConnected(false);
        const attempt = (reconnectAttemptsRef.current[wsIndex] || 0);
        reconnectAttemptsRef.current[wsIndex] = attempt + 1;
        reconnectRefs.current[wsIndex] = setTimeout(
          () => connectLiquidation(config, index),
          getBackoff(attempt)
        );
      };
    } catch {
      const attempt = (reconnectAttemptsRef.current[wsIndex] || 0);
      reconnectAttemptsRef.current[wsIndex] = attempt + 1;
      reconnectRefs.current[wsIndex] = setTimeout(
        () => connectLiquidation(config, index),
        getBackoff(attempt)
      );
    }
  }, []);

  useEffect(() => {
    wsRefs.current = new Array(EXCHANGES.length).fill(null);
    liqWsRefs.current = new Array(LIQUIDATION_FEEDS.length).fill(null);
    reconnectRefs.current = [];
    reconnectAttemptsRef.current = new Array(EXCHANGES.length + LIQUIDATION_FEEDS.length).fill(0);
    EXCHANGES.forEach((cfg, i) => connectExchange(cfg, i));
    LIQUIDATION_FEEDS.forEach((cfg, i) => connectLiquidation(cfg, i));

    return () => {
      wsRefs.current.forEach((ws) => ws?.close());
      liqWsRefs.current.forEach((ws) => ws?.close());
      reconnectRefs.current.forEach((t) => clearTimeout(t));
    };
  }, [connectExchange, connectLiquidation]);

  return { events, liquidations, isConnected, error, currentPrice, totalMonitored, volumeStats, cvdHistory, exchangeImbalances, speedStats, whaleScore };
}
