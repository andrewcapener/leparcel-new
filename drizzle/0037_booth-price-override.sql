-- A per booking price, changeable by staff.
--
-- Drew, 21 Sept 2026: "I'm pretty sure all of the fees should be fairly
-- standard. If there's anything custom, it might be one or two people, and I
-- can clarify that before we finalize all the payments."
--
-- One or two is enough. bookings.price_cents was already the snapshot every
-- invoice and every Checkout line item is built from, so the number was always
-- per booking; there was simply no way to change it short of SQL, and a SQL
-- edit writes no audit row (rule 3).
--
-- The quiet failure this closes: a maker whose real deal is not the list price
-- opens an invoice showing the list price, pays it, and the webhook confirms
-- happily, because the invoice and the payment agree with each other and both
-- are wrong. Nothing catches that until somebody reconciles by hand.
--
-- price_version exists because Stripe rejects a reused idempotency key whose
-- parameters have changed, and correcting a price changes the line items. It
-- is what the version argument on bookingPaymentKey was always for. Bumping it
-- makes the next call new work rather than a replay of the old answer.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS price_version integer NOT NULL DEFAULT 1;
