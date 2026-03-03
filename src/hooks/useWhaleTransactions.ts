// BTC Whale Tracker - Multi-exchange real-time WebSocket hook v5
// Features: Burst aggregation, enhanced analytics, whale score breakdown, multi-timeframe
import { useState, useEffect, useRef, useCallback } from 'react';

export interface WhaleEvent {
  id: string;
  type: 'buy' | 'sell' | 'liquidation';
  direction?: 'long' | 'short';
  btcAmount: number;
  usdValue: number;
  pricePerBtc: number;
  exchange: string;
  timestamp: Date;
  tradeCount: number;
  isMega?: boolean;
}

export interface VolumeStats {
  buy1m: number;
  sell1m: number;
  buy5m: number;
  sell5m: number;
  buy15m: number;
  sell15m: number;
  netDelta1m: number;
  netDelta5m: number;
  netDelta15m: number;
  spotNet1m: number;
  spotNet5m: number;
  spotNet15m: number;
  futuresNet1m: number;
  futuresNet5m: number;
  futuresNet15m: number;
  // Volume anomaly: ratio of current 1m vol vs rolling 5m average per minute
  volumeAnomalyRatio: number;
}

export interface CvdPoint {
  time: string;
  cvd: number;
  price: number;
}

export interface ExchangeImbalance {
  exchange: string;
  buyVol1m: number;
  sellVol1m: number;
  net1m: number;
  buyVol5m: number;
  sellVol5m: number;
  net5m: number;
  label1m: 'Heavy Buying' | 'Heavy Selling' | 'Neutral';
  label5m: 'Heavy Buying' | 'Heavy Selling' | 'Neutral';
  dominance5m: number; // % of total 5m volume
}

export interface SpeedStats {
  tradesPerSec: number;
  volumePerSec: number;
  whalesPerMin: number;
  liqsPerMin: number;
  intensity: 'low' | 'medium' | 'high';
  spike: boolean;
  prevTradesPerSec: number;
}

export interface WhaleScoreBreakdown {
  volumeIntensity: number;    // 0-20
  tradeVelocity: number;      // 0-20
  aggressionFactor: number;   // 0-20
  exchangeDiversity: number;  // 0-20
  liquidationCorrelation: number; // 0-20
}

export interface WhaleScore {
  score: number;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  breakdown: WhaleScoreBreakdown;
  wpiTrend: 'rising' | 'falling' | 'stable'; // Whale Pressure Index trend
}

export interface SpotFuturesDivergence {
  divergent: boolean;
  spotBias: 'buy' | 'sell' | 'neutral';
  futuresBias: 'buy' | 'sell' | 'neutral';
  magnitude: number; // 0-100
}

const DEFAULT_MIN_USD = 50_000;
const TRADE_AGGREGATION_WINDOW = 500;
const LIQ_AGGREGATION_WINDOW = 50;
const VOLUME_WINDOW_1M = 60_000;
const VOLUME_WINDOW_5M = 300_000;
const VOLUME_WINDOW_15M = 900_000;
const MEGA_THRESHOLD = 2_000_000;
const MAX_TRADE_BUFFER = 200;
const MAX_LIQ_BUFFER = 1000;

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
      const rawSz = parseFloat(d.sz);
      const price = parseFloat(d.px);
      // OKX Futures sz = number of contracts, convert to BTC
      const quantity = okxCtValCcy === 'BTC'
        ? rawSz * okxCtVal
        : (price > 0 ? (rawSz * okxCtVal) / price : 0);
      return {
        price,
        quantity,
        isSell: d.side === 'sell',
        tradeId: d.tradeId,
        timestamp: parseInt(d.ts),
      };
    },
  },
];

let okxCtVal = 0.01;
let okxCtValCcy: 'BTC' | 'USDT' = 'BTC';

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
        price, quantity, usdValue,
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
      const usdValue = size;
      const quantity = price > 0 ? usdValue / price : 0;
      if (!isFinite(usdValue) || usdValue <= 0) return null;
      return {
        price, quantity, usdValue,
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
        price, quantity, usdValue,
        side: details.side === 'sell' ? 'long' as const : 'short' as const,
        timestamp,
      };
    },
  },
];

function getBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

function getImbalanceLabel(buy: number, sell: number): 'Heavy Buying' | 'Heavy Selling' | 'Neutral' {
  const net = buy - sell;
  const total = buy + sell;
  const ratio = total > 0 ? Math.abs(net) / total : 0;
  return ratio < 0.15 ? 'Neutral' : net > 0 ? 'Heavy Buying' : 'Heavy Selling';
}

export function useWhaleTransactions(minUsd: number = DEFAULT_MIN_USD) {
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [liquidations, setLiquidations] = useState<WhaleEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [totalMonitored, setTotalMonitored] = useState(0);
  const [volumeStats, setVolumeStats] = useState<VolumeStats>({
    buy1m: 0, sell1m: 0, buy5m: 0, sell5m: 0, buy15m: 0, sell15m: 0,
    netDelta1m: 0, netDelta5m: 0, netDelta15m: 0,
    spotNet1m: 0, spotNet5m: 0, spotNet15m: 0,
    futuresNet1m: 0, futuresNet5m: 0, futuresNet15m: 0,
    volumeAnomalyRatio: 1,
  });
  const [cvdHistory, setCvdHistory] = useState<CvdPoint[]>([]);
  const [exchangeImbalances, setExchangeImbalances] = useState<ExchangeImbalance[]>([]);
  const [speedStats, setSpeedStats] = useState<SpeedStats>({
    tradesPerSec: 0, volumePerSec: 0, whalesPerMin: 0, liqsPerMin: 0,
    intensity: 'low', spike: false, prevTradesPerSec: 0,
  });
  const [whaleScore, setWhaleScore] = useState<WhaleScore>({
    score: 50, sentiment: 'Neutral',
    breakdown: { volumeIntensity: 10, tradeVelocity: 10, aggressionFactor: 10, exchangeDiversity: 10, liquidationCorrelation: 10 },
    wpiTrend: 'stable',
  });
  const [divergence, setDivergence] = useState<SpotFuturesDivergence>({
    divergent: false, spotBias: 'neutral', futuresBias: 'neutral', magnitude: 0,
  });

  const cvdAccumRef = useRef(0);
  const cvdLastTsRef = useRef(0);
  const wsRefs = useRef<(WebSocket | null)[]>([]);
  const liqWsRefs = useRef<(WebSocket | null)[]>([]);
  const reconnectRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reconnectAttemptsRef = useRef<number[]>([]);
  const tradeBufferRef = useRef<RawTrade[]>([]);
  const liqRawBufferRef = useRef<RawLiquidation[]>([]);
  const flushRef = useRef<ReturnType<typeof setInterval>>();
  const liqFlushRef = useRef<ReturnType<typeof setInterval>>();
  const volumeRef = useRef<ReturnType<typeof setInterval>>();
  const monitorCountRef = useRef(0);
  const connectedCountRef = useRef(0);
  const minUsdRef = useRef(minUsd);
  const volumeTradesRef = useRef<{ timestamp: number; usdValue: number; isSell: boolean; exchange: string }[]>([]);
  // Track whale events and liquidations timestamps for speed metrics
  const whaleTimestampsRef = useRef<number[]>([]);
  const liqTimestampsRef = useRef<number[]>([]);
  const prevTpsRef = useRef(0);
  const wpiHistoryRef = useRef<number[]>([]);
  const priceRef = useRef(0);

  useEffect(() => {
    minUsdRef.current = minUsd;
  }, [minUsd]);

  // Trade burst aggregation (500ms)
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
          whaleTimestampsRef.current.push(Date.now());
          setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_TRADE_BUFFER));
        }
      }

      setTotalMonitored(monitorCountRef.current);
    }, TRADE_AGGREGATION_WINDOW);

    return () => {
      if (flushRef.current) clearInterval(flushRef.current);
    };
  }, []);

  // Liquidation burst aggregation
  useEffect(() => {
    liqFlushRef.current = setInterval(() => {
      const buffer = liqRawBufferRef.current;
      liqRawBufferRef.current = [];
      if (buffer.length === 0) return;

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
        liqTimestampsRef.current.push(Date.now());
        setLiquidations((prev) => [...newLiqs, ...prev].slice(0, MAX_LIQ_BUFFER));
      }
    }, LIQ_AGGREGATION_WINDOW);

    return () => {
      if (liqFlushRef.current) clearInterval(liqFlushRef.current);
    };
  }, []);

  // Reset CVD
  const resetCvd = useCallback(() => {
    cvdAccumRef.current = 0;
    cvdLastTsRef.current = 0;
    setCvdHistory([]);
  }, []);

  // Volume stats computation - every second
  useEffect(() => {
    volumeRef.current = setInterval(() => {
      const now = Date.now();
      volumeTradesRef.current = volumeTradesRef.current.filter(
        (t) => now - t.timestamp < VOLUME_WINDOW_15M
      );

      const trades = volumeTradesRef.current;
      let buy1m = 0, sell1m = 0, buy5m = 0, sell5m = 0, buy15m = 0, sell15m = 0;
      let spotBuy1m = 0, spotSell1m = 0, futBuy1m = 0, futSell1m = 0;
      let spotBuy5m = 0, spotSell5m = 0, futBuy5m = 0, futSell5m = 0;
      let spotBuy15m = 0, spotSell15m = 0, futBuy15m = 0, futSell15m = 0;

      for (const t of trades) {
        const age = now - t.timestamp;
        const isFutures = t.exchange.includes('Futures');
        if (t.isSell) {
          sell15m += t.usdValue;
          if (isFutures) futSell15m += t.usdValue; else spotSell15m += t.usdValue;
          if (age < VOLUME_WINDOW_5M) {
            sell5m += t.usdValue;
            if (isFutures) futSell5m += t.usdValue; else spotSell5m += t.usdValue;
          }
          if (age < VOLUME_WINDOW_1M) {
            sell1m += t.usdValue;
            if (isFutures) futSell1m += t.usdValue; else spotSell1m += t.usdValue;
          }
        } else {
          buy15m += t.usdValue;
          if (isFutures) futBuy15m += t.usdValue; else spotBuy15m += t.usdValue;
          if (age < VOLUME_WINDOW_5M) {
            buy5m += t.usdValue;
            if (isFutures) futBuy5m += t.usdValue; else spotBuy5m += t.usdValue;
          }
          if (age < VOLUME_WINDOW_1M) {
            buy1m += t.usdValue;
            if (isFutures) futBuy1m += t.usdValue; else spotBuy1m += t.usdValue;
          }
        }
      }

      // Volume anomaly: 1m vol vs average per minute from 5m window
      const vol1m = buy1m + sell1m;
      const vol5m = buy5m + sell5m;
      const avgPerMin5m = vol5m / 5;
      const anomalyRatio = avgPerMin5m > 0 ? vol1m / avgPerMin5m : 1;

      setVolumeStats({
        buy1m, sell1m, buy5m, sell5m, buy15m, sell15m,
        netDelta1m: buy1m - sell1m,
        netDelta5m: buy5m - sell5m,
        netDelta15m: buy15m - sell15m,
        spotNet1m: spotBuy1m - spotSell1m,
        spotNet5m: spotBuy5m - spotSell5m,
        spotNet15m: spotBuy15m - spotSell15m,
        futuresNet1m: futBuy1m - futSell1m,
        futuresNet5m: futBuy5m - futSell5m,
        futuresNet15m: futBuy15m - futSell15m,
        volumeAnomalyRatio: anomalyRatio,
      });

      // CVD with price tracking
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
      setCvdHistory(prev => [...prev.slice(-119), { time: timeStr, cvd: cvdAccumRef.current, price: priceRef.current }]);

      // Exchange Imbalance (1m + 5m) — keep spot and futures separate
      const exchMap1m = new Map<string, { buy: number; sell: number }>();
      const exchMap5m = new Map<string, { buy: number; sell: number }>();
      let totalVol5m = 0;
      for (const t of trades) {
        const age = now - t.timestamp;
        // Keep full exchange name (don't merge spot + futures)
        const exchName = t.exchange;
        if (age < VOLUME_WINDOW_5M) {
          const e5 = exchMap5m.get(exchName) || { buy: 0, sell: 0 };
          if (t.isSell) e5.sell += t.usdValue; else e5.buy += t.usdValue;
          exchMap5m.set(exchName, e5);
          totalVol5m += t.usdValue;
        }
        if (age < VOLUME_WINDOW_1M) {
          const e1 = exchMap1m.get(exchName) || { buy: 0, sell: 0 };
          if (t.isSell) e1.sell += t.usdValue; else e1.buy += t.usdValue;
          exchMap1m.set(exchName, e1);
        }
      }
      const imbalances: ExchangeImbalance[] = [];
      const allExchanges = new Set([...exchMap1m.keys(), ...exchMap5m.keys()]);
      for (const exchange of allExchanges) {
        const d1 = exchMap1m.get(exchange) || { buy: 0, sell: 0 };
        const d5 = exchMap5m.get(exchange) || { buy: 0, sell: 0 };
        imbalances.push({
          exchange,
          buyVol1m: d1.buy, sellVol1m: d1.sell, net1m: d1.buy - d1.sell,
          buyVol5m: d5.buy, sellVol5m: d5.sell, net5m: d5.buy - d5.sell,
          label1m: getImbalanceLabel(d1.buy, d1.sell),
          label5m: getImbalanceLabel(d5.buy, d5.sell),
          dominance5m: totalVol5m > 0 ? ((d5.buy + d5.sell) / totalVol5m) * 100 : 0,
        });
      }
      // Sort by dominance
      imbalances.sort((a, b) => b.dominance5m - a.dominance5m);
      setExchangeImbalances(imbalances);

      // Speed Meter (3s avg) + whale/min + liq/min + spike detection
      const recentWindow = trades.filter(t => now - t.timestamp < 3000);
      const tps = recentWindow.length / 3;
      const vps = recentWindow.reduce((s, t) => s + t.usdValue, 0) / 3;

      // Clean old timestamps (keep 1 min)
      whaleTimestampsRef.current = whaleTimestampsRef.current.filter(ts => now - ts < 60_000);
      liqTimestampsRef.current = liqTimestampsRef.current.filter(ts => now - ts < 60_000);

      const wpm = whaleTimestampsRef.current.length;
      const lpm = liqTimestampsRef.current.length;
      const prevTps = prevTpsRef.current;
      const spike = tps > 30 && tps > prevTps * 2.5;
      prevTpsRef.current = tps;

      setSpeedStats({
        tradesPerSec: Math.round(tps),
        volumePerSec: vps,
        whalesPerMin: wpm,
        liqsPerMin: lpm,
        intensity: tps > 50 ? 'high' : tps > 15 ? 'medium' : 'low',
        spike,
        prevTradesPerSec: Math.round(prevTps),
      });

      // Enhanced Whale Score with breakdown
      const totalTradeCount = trades.length;
      
      // 1. Volume Intensity (0-20): how much volume vs expected
      const volumeIntensity = Math.min((anomalyRatio / 3) * 20, 20);

      // 2. Trade Velocity (0-20): trades per second normalized
      const tradeVelocity = Math.min((tps / 60) * 20, 20);

      // 3. Aggression Factor (0-20): imbalance between buy/sell
      const totalBuys = buy5m;
      const totalSells = sell5m;
      const totalVol = totalBuys + totalSells;
      const aggressionFactor = totalVol > 0 ? Math.min((Math.abs(totalBuys - totalSells) / totalVol) * 40, 20) : 0;

      // 4. Exchange Diversity (0-20): more exchanges active = higher
      const activeExchanges = imbalances.filter(e => (e.buyVol1m + e.sellVol1m) > 0).length;
      const exchangeDiversity = Math.min((activeExchanges / 4) * 20, 20);

      // 5. Liquidation Correlation (0-20): liquidation activity correlating with volume
      const liquidationCorrelation = Math.min((lpm / 10) * 20, 20);

      const breakdown: WhaleScoreBreakdown = {
        volumeIntensity: Math.round(volumeIntensity * 10) / 10,
        tradeVelocity: Math.round(tradeVelocity * 10) / 10,
        aggressionFactor: Math.round(aggressionFactor * 10) / 10,
        exchangeDiversity: Math.round(exchangeDiversity * 10) / 10,
        liquidationCorrelation: Math.round(liquidationCorrelation * 10) / 10,
      };

      const rawScore = volumeIntensity + tradeVelocity + aggressionFactor + exchangeDiversity + liquidationCorrelation;
      const score = Math.round(Math.min(Math.max(rawScore, 0), 100));
      
      // WPI trend
      wpiHistoryRef.current.push(score);
      if (wpiHistoryRef.current.length > 30) wpiHistoryRef.current = wpiHistoryRef.current.slice(-30);
      const wpiRecent = wpiHistoryRef.current.slice(-5);
      const wpiOlder = wpiHistoryRef.current.slice(-15, -5);
      const avgRecent = wpiRecent.reduce((a, b) => a + b, 0) / wpiRecent.length;
      const avgOlder = wpiOlder.length > 0 ? wpiOlder.reduce((a, b) => a + b, 0) / wpiOlder.length : avgRecent;
      const wpiTrend: 'rising' | 'falling' | 'stable' = avgRecent > avgOlder + 5 ? 'rising' : avgRecent < avgOlder - 5 ? 'falling' : 'stable';

      const dir = buy5m - sell5m;
      setWhaleScore({
        score,
        sentiment: totalVol > 0 && Math.abs(dir) / totalVol < 0.05 ? 'Neutral' : dir > 0 ? 'Bullish' : 'Bearish',
        breakdown,
        wpiTrend,
      });

      // Spot vs Futures Divergence
      const spotNet = spotBuy5m - spotSell5m;
      const futNet = futBuy5m - futSell5m;
      const spotTotal = spotBuy5m + spotSell5m;
      const futTotal = futBuy5m + futSell5m;
      const spotBias: 'buy' | 'sell' | 'neutral' = spotTotal > 0 ? (Math.abs(spotNet) / spotTotal < 0.1 ? 'neutral' : spotNet > 0 ? 'buy' : 'sell') : 'neutral';
      const futuresBias: 'buy' | 'sell' | 'neutral' = futTotal > 0 ? (Math.abs(futNet) / futTotal < 0.1 ? 'neutral' : futNet > 0 ? 'buy' : 'sell') : 'neutral';
      const isDivergent = spotBias !== 'neutral' && futuresBias !== 'neutral' && spotBias !== futuresBias;
      const divMagnitude = isDivergent && (spotTotal + futTotal) > 0
        ? Math.min(Math.abs(spotNet - futNet) / (spotTotal + futTotal) * 200, 100)
        : 0;
      setDivergence({
        divergent: isDivergent,
        spotBias,
        futuresBias,
        magnitude: Math.round(divMagnitude),
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
        reconnectAttemptsRef.current[index] = 0;
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
          priceRef.current = price;
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

  return {
    events, liquidations, isConnected, error, currentPrice, totalMonitored,
    volumeStats, cvdHistory, exchangeImbalances, speedStats, whaleScore,
    divergence, resetCvd,
  };
}
