import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const windows = [
      { label: "1h", ms: 3_600_000 },
      { label: "4h", ms: 14_400_000 },
      { label: "12h", ms: 43_200_000 },
      { label: "24h", ms: 86_400_000 },
    ];

    // Fetch all events within 24h
    const cutoff24h = new Date(now.getTime() - 86_400_000).toISOString();
    const { data: events, error } = await supabase
      .from("liquidation_events")
      .select("*")
      .gte("source_timestamp", cutoff24h)
      .order("source_timestamp", { ascending: false })
      .limit(10000);

    if (error) throw error;

    const allEvents = events || [];

    // Aggregate by time window
    const timeBreakdown = windows.map(({ label, ms }) => {
      const cutoff = now.getTime() - ms;
      let longUsd = 0;
      let shortUsd = 0;
      let count = 0;
      for (const e of allEvents) {
        const ts = new Date(e.source_timestamp).getTime();
        if (ts < cutoff) continue;
        if (e.direction === "long") longUsd += e.notional_usd;
        else shortUsd += e.notional_usd;
        count++;
      }
      return { label, longUsd, shortUsd, count };
    });

    // Largest single event
    let largest: any = null;
    for (const e of allEvents) {
      if (!largest || e.notional_usd > largest.notional_usd) largest = e;
    }

    // Average size
    const totalUsd = allEvents.reduce((s: number, e: any) => s + e.notional_usd, 0);
    const avgSize = allEvents.length > 0 ? totalUsd / allEvents.length : 0;

    // Top exchanges
    const exchMap = new Map<string, number>();
    for (const e of allEvents) {
      exchMap.set(e.exchange, (exchMap.get(e.exchange) || 0) + e.notional_usd);
    }
    const topExchanges = [...exchMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, volume]) => ({ name, volume }));

    const response = {
      timeBreakdown,
      largest: largest
        ? {
            usdValue: largest.notional_usd,
            direction: largest.direction,
            exchange: largest.exchange,
            price: largest.price,
            timestamp: new Date(largest.source_timestamp).getTime(),
          }
        : null,
      avgSize,
      totalEvents: allEvents.length,
      topExchanges,
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
