-- Booth fee payments. The first money this platform actually moves.
--
-- Until now `decide()` created a booking, snapshotted its price and commission,
-- emailed the maker "Pay to confirm within 48 hours", and stopped. There was
-- nowhere to pay. Every booking sat at awaiting_payment forever and /account
-- told the maker their acceptance "carries a payment link" that did not exist.
-- Decisions for Fall 2026 go out September 22 to 24, so this is the gap that
-- had to close first.
--
-- Two additions, and the reasoning for each is a rule in CLAUDE.md.
--
-- 1. Stripe references ON the booking, not a parallel payments table. A booking
--    is paid once. The session is what the maker was sent to, the payment
--    intent is what actually charged, and amount_paid_cents is what Stripe says
--    arrived rather than what we think we asked for. Storing the received
--    amount separately is what lets a partial or altered payment show up as a
--    mismatch instead of quietly reading as paid.
--
-- 2. stripe_events, because webhooks are the source of truth for payment state
--    (rule 5) and Stripe delivers at least once, not exactly once. The event id
--    is the primary key, so a replayed delivery hits a conflict and does
--    nothing. Without this table a retried webhook confirms a booking twice and
--    writes two audit rows for one payment.
--
-- Money stays integer cents (rule 1). Forward-only and idempotent (rule 11).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id        text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid_cents        integer;

-- One booking per Stripe object, both directions. A webhook arrives naming a
-- session or an intent and has to find exactly one booking; a unique index is
-- what makes that lookup safe rather than a "first row wins" guess.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_session
  ON bookings (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_payment_intent
  ON bookings (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,          -- Stripe's evt_… id. The whole point.
  type         text NOT NULL,
  booking_id   text REFERENCES bookings(id),
  payload      text NOT NULL DEFAULT '',  -- trimmed; never card data
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,               -- null = seen but not finished
  error        text
);

CREATE INDEX IF NOT EXISTS stripe_events_booking ON stripe_events (booking_id);

-- RLS, on the same terms as every other table (rule 12, migration 0029). The
-- app connects as a BYPASSRLS role; this denies everything through PostgREST.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
