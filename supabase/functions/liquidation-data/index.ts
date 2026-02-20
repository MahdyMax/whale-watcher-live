import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NormalizedLiq {
  exchange: string;
  direction: "long" | "short";
  notionalUSD: number;
  price: number;
  quantity: number;
  timestamp: number;
}

// --- Binance: GET /fapi/v1/allForceOrders ---
async function fetchBinanceLiquidations(): Promise<NormalizedLiq[]> {
  try {
    const res = await fetch(
      "https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=1000"
    );
    if (!res.ok) {
      console.error("[Binance] HTTP", res.status);
      return [];
    }
    const data = await res.json();
    return (data as any[])
      .map((o: any) => {
        const price = parseFloat(o.average_price || o.price);
        const qty = parseFloat(o.orig_qty || o.executedQty);
        const notionalUSD = price * qty;
        if (!isFinite(notionalUSD) || notionalUSD <= 0) return null;
        return {
          exchange: "Binance",
          direction: (o.side === "SELL" ? "long" : "short") as "long" | "short",
          notionalUSD,
          price,
          quantity: qty,
          timestamp: Number(o.time),
        };
      })
      .filter(Boolean) as NormalizedLiq[];
  } catch (e) {
    console.error("[Binance] fetch error:", e);
    return [];
  }
}

// --- Bybit: GET /v5/market/recent-trade (liquidation category) ---
async function fetchBybitLiquidations(): Promise<NormalizedLiq[]> {
  try {
    // Bybit doesn't have a public liquidation history REST endpoint,
    // but we can try the recent-trade endpoint for linear
    const res = await fetch(
      "https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=BTCUSDT&limit=1000"
    );
    if (!res.ok) {
      console.error("[Bybit] HTTP", res.status);
      return [];
    }
    const json = await res.json();
    // Bybit recent-trade is regular trades, not liquidations
    // There is no public REST liquidation endpoint for Bybit
    // Return empty - Bybit liquidations come from WebSocket only
    return [];
  } catch (e) {
    console.error("[Bybit] fetch error:", e);
    return [];
  }
}

// --- OKX: fetch contract info + liquidation orders ---
let okxCtVal = 0.01;
let okxCtValCcy: "BTC" | "USDT" = "BTC";

async function fetchOkxContractInfo() {
  try {
    const res = await fetch(
      "https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=BTC-USDT-SWAP"
    );
    const json = await res.json();
    const inst = json?.data?.[0];
    if (inst) {
      okxCtVal = parseFloat(inst.ctVal) || 0.01;
      okxCtValCcy = inst.ctValCcy === "USDT" ? "USDT" : "BTC";
      console.log(`[OKX] Contract size: ${okxCtVal} ${okxCtValCcy}`);
    }
  } catch (e) {
    console.warn("[OKX] Failed to fetch contract info:", e);
  }
}

async function fetchOkxLiquidations(): Promise<NormalizedLiq[]> {
  // OKX doesn't have a public REST endpoint for historical liquidations
  // The liquidation-orders channel is WebSocket-only
  return [];
}

// Aggregate by time window
function aggregateByWindow(
  liqs: NormalizedLiq[],
  windowMs: number
): { longUsd: number; shortUsd: number; count: number } {
  const cutoff = Date.now() - windowMs;
  let longUsd = 0;
  let shortUsd = 0;
  let count = 0;
  for (const l of liqs) {
    if (l.timestamp < cutoff) continue;
    if (l.direction === "long") longUsd += l.notionalUSD;
    else shortUsd += l.notionalUSD;
    count++;
  }
  return { longUsd, shortUsd, count };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch OKX contract info + all exchange data in parallel
    await fetchOkxContractInfo();

    const [binance, _bybit, _okx] = await Promise.all([
      fetchBinanceLiquidations(),
      fetchBybitLiquidations(),
      fetchOkxLiquidations(),
    ]);

    const allLiqs = [...binance]; // Bybit & OKX REST not available

    // Time windows
    const windows = [
      { label: "1h", ms: 3_600_000 },
      { label: "4h", ms: 14_400_000 },
      { label: "12h", ms: 43_200_000 },
      { label: "24h", ms: 86_400_000 },
    ];

    const timeBreakdown = windows.map((w) => ({
      label: w.label,
      ...aggregateByWindow(allLiqs, w.ms),
    }));

    // Largest single liquidation
    let largest: NormalizedLiq | null = null;
    for (const l of allLiqs) {
      if (!largest || l.notionalUSD > largest.notionalUSD) largest = l;
    }

    // Average size
    const totalUsd = allLiqs.reduce((s, l) => s + l.notionalUSD, 0);
    const avgSize = allLiqs.length > 0 ? totalUsd / allLiqs.length : 0;

    // Top exchanges
    const exchMap = new Map<string, number>();
    for (const l of allLiqs) {
      exchMap.set(l.exchange, (exchMap.get(l.exchange) || 0) + l.notionalUSD);
    }
    const topExchanges = [...exchMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, vol]) => ({ name, volume: vol }));

    const response = {
      timeBreakdown,
      largest: largest
        ? {
            usdValue: largest.notionalUSD,
            direction: largest.direction,
            exchange: largest.exchange,
            price: largest.price,
            timestamp: largest.timestamp,
          }
        : null,
      avgSize,
      totalEvents: allLiqs.length,
      topExchanges,
      sources: ["Binance"],
      note: "Bybit and OKX liquidation history not available via REST API. Live WebSocket data supplements this.",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to fetch liquidation data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
