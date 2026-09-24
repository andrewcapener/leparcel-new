-- Things added to or taken off a booking after it was made.
--
-- Drew, 24 Sept: "consider this like an e-commerce thing where things might
-- change over time. We might add fees, they might want priority, they might
-- want an extra day, they might want a bigger booth, they might want a
-- smaller booth. We need to have some flexibility there."
--
-- Until now a booking had one price and that price was frozen the moment
-- money moved, because editing a fee after the bank has seen it only makes
-- the record disagree with reality. That is the right rule and the wrong
-- shape: what actually happens is that the ORDER changes, and the difference
-- is owed or is owing. So the fee stops being a single number and becomes a
-- running total: the space, plus whatever has been added, minus whatever has
-- come off.
--
-- One row per change, never an edit in place. `amount_cents` is signed: a
-- second day is positive, a downgrade is negative. Integer cents (rule 1).
--
-- Nothing is ever deleted. Taking something off a maker's invoice voids the
-- row and leaves it there, with who did it and why, because an invoice that
-- quietly loses a line is an invoice nobody can reconcile in December
-- (rule 3). `voided_at` being null is what makes a line count.
--
-- Deliberately NOT a status change. A booking that is confirmed and then
-- grows a $450 second day is still confirmed; it simply has a balance. The
-- payment status belongs to Stripe and to staff pressing Mark paid (rule 5),
-- and a line item must never be able to mark anything paid.
--
-- Forward-only and idempotent (rule 11).

CREATE TABLE IF NOT EXISTS booking_charges (
  id            text PRIMARY KEY,
  booking_id    text NOT NULL REFERENCES bookings(id),
  -- What the maker sees on their invoice: "Sunday booth", "Corner placement".
  description   text NOT NULL,
  -- Signed. Positive is owed, negative comes off.
  amount_cents  integer NOT NULL,
  -- Why, for the audit trail and for the person reading it back in December.
  reason        text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL DEFAULT 'staff',
  -- Voided rather than deleted. Null means this line counts.
  voided_at     timestamptz,
  voided_by     text,
  void_reason   text
);

CREATE INDEX IF NOT EXISTS booking_charges_booking ON booking_charges (booking_id);
