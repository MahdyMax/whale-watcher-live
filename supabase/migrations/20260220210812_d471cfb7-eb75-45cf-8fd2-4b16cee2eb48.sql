
-- Table to persist liquidation events from WebSocket feeds
CREATE TABLE public.liquidation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  notional_usd DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 1,
  source_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for time-range queries
CREATE INDEX idx_liq_events_source_ts ON public.liquidation_events (source_timestamp DESC);

-- Enable RLS but allow public inserts and reads (this is public market data)
ALTER TABLE public.liquidation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read liquidation events"
  ON public.liquidation_events FOR SELECT USING (true);

CREATE POLICY "Anyone can insert liquidation events"
  ON public.liquidation_events FOR INSERT WITH CHECK (true);

-- Auto-cleanup: delete events older than 25 hours (keep 24h + 1h buffer)
-- We'll handle this via a scheduled edge function or manual cleanup
