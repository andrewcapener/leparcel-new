-- Stripe Connect: how a maker gets paid.
--
-- Drew, 21 Sept 2026: "this was the entire goal ... so that they only have to
-- set up stripe once and we can pay them automatically."
--
-- Worth stating plainly because the whole payment-method decision was built on
-- the opposite belief: paying Mermade by bank transfer does NOT create a
-- Connect account. Financial Connections links a bank so Stripe can DEBIT it
-- once, and produces a payment method on Mermade's own customer object. It
-- carries no identity check, no tax ID, and no permission for money to move
-- the other way. Getting paid is a separate account the maker owns, with its
-- own onboarding. These columns are that account.
--
-- Express, per docs/04 §3: Stripe chases the maker for KYC, Mermade keeps
-- control of payout timing, and the maker gets a light dashboard rather than
-- a full one.
--
-- Only indoor makers ever need this. Mermade rings those sales and owes the
-- money on; an outdoor maker runs their own register and is never owed a cent.
--
-- On vendors rather than bookings on purpose: a maker sets this up once and it
-- holds for every show after. That is the point Drew is making.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS stripe_account_id     text,
  -- Stripe's own answer, never ours: true only when Stripe says money can
  -- actually leave. A statement must never be paid against our guess.
  ADD COLUMN IF NOT EXISTS payouts_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS charges_enabled       boolean NOT NULL DEFAULT false,
  -- What Stripe is still waiting for, as JSON, so the maker is told exactly
  -- what to go and do instead of "your account is restricted".
  ADD COLUMN IF NOT EXISTS connect_requirements  text NOT NULL DEFAULT '[]',
  -- Set when Stripe says something is overdue or an account is disabled, so
  -- staff can see the difference between "not finished" and "gone wrong".
  ADD COLUMN IF NOT EXISTS connect_disabled_reason text,
  ADD COLUMN IF NOT EXISTS connect_updated_at    text;

-- One Stripe account per vendor. Partial, because everybody predating this
-- migration has NULL and NULLs must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS vendors_stripe_account_key
  ON vendors (stripe_account_id) WHERE stripe_account_id IS NOT NULL;
