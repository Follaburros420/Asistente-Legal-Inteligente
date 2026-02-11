-- Migration: Create Wompi webhook events table (idempotency + audit)
-- Replayed: 2026-02-11 (align remote migration history)

CREATE TABLE IF NOT EXISTS wompi_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    event_type TEXT,
    wompi_transaction_id TEXT,
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    payload JSONB,
    signature TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wompi_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service-role should access this table (service role bypasses RLS).
REVOKE ALL ON wompi_webhook_events FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_wompi_webhook_events_updated_at ON wompi_webhook_events;
CREATE TRIGGER update_wompi_webhook_events_updated_at
  BEFORE UPDATE ON wompi_webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

