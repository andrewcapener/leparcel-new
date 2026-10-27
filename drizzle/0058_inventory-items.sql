-- A maker's item list: what the register needs in order to sell their work.
--
-- Drew, 27 October: an email goes out to every accepted indoor maker asking
-- for two things, their payout account and their inventory, and "I would love
-- to build a tool that's like really easy for them to just input their
-- inventory, so it's all uniformed."
--
-- Uniform is the whole point. Today a maker types a price list into the body
-- of an email, in whatever shape they like, and somebody keys every line of
-- it into the register by hand. Hillary's instruction even says "I repeat, do
-- not send us a separate file", because a spreadsheet per maker is worse than
-- an email per maker. This table is that same list, in one shape, typed once
-- by the person who actually knows the prices.
--
-- ── what a row is ────────────────────────────────────────────────────────
-- A KIND of goods at a PRICE, not a SKU and not stock. From her own example:
--
--     MM15 Maggie's Maps:
--     Maps: $5 or buy 2/$8
--     Stickers/Maps/gift tags: $7
--     Table cloths / Backpacks: $20 or buy 2/$36
--
-- A maker with forty stickers at $7 writes one row. That is why this has
-- always been short enough for somebody to actually fill in, and keeping it
-- that short is the only reason they will.
--
-- Hung off the booking rather than the vendor, so it is scoped to a show
-- (rule 6) and a maker's spring list never turns up at the winter register.
--
-- Money is integer cents (rule 1). Nothing is ever deleted (rule 3): a line
-- a maker removes is voided, so the list can be reconstructed as it stood on
-- the day it locked.
--
-- Forward-only and idempotent (rule 11).

CREATE TABLE IF NOT EXISTS inventory_items (
  id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES bookings(id),

  -- "Maps", "Stickers/Maps/gift tags". What a shopper would call it.
  label text NOT NULL,
  price_cents integer NOT NULL,

  -- The multi-buy, when there is one: 2 and 800 is "buy 2/$8". Both null or
  -- both set; half a bundle is a price nobody can ring up.
  bundle_qty integer,
  bundle_cents integer,

  -- Anything the maker wants the register to know. Never shown to shoppers.
  note text,

  -- The maker's own order. Their list reads back the way they wrote it.
  sort_order integer,

  created_at text NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::text,
  created_by text NOT NULL DEFAULT 'maker',
  updated_at text,

  voided_at text,
  voided_by text,
  void_reason text
);

CREATE INDEX IF NOT EXISTS inventory_items_booking
  ON inventory_items (booking_id);

-- The live list for one booking, which is what the register reads.
CREATE INDEX IF NOT EXISTS inventory_items_live
  ON inventory_items (booking_id, sort_order)
  WHERE voided_at IS NULL;
