-- What a hand-matched payment was worth.
--
-- markPaid recorded that a Venmo or a Zelle had arrived and never recorded
-- how much. That was harmless while a booking was one frozen price and the
-- status answered the whole question. It stopped being harmless when the
-- booking became a running total: the ledger computes what is owed as
-- total minus what has arrived, and what had arrived was null.
--
-- The result, on Fall 26: seventeen makers who had genuinely paid, and been
-- confirmed by a person reading the payment note, read as owing their fee in
-- full. $5,840 of debt on the payment sheet that nobody owed, Elise unable to
-- tell from the sheet who was actually behind, and a Pay button about to be
-- shown to every one of them for money they had already sent.
--
-- The code is fixed so this cannot happen again. This is the seventeen rows
-- that were written before the fix.
--
-- Only rows that are confirmed AND have nothing recorded. A booking that
-- Stripe settled already carries the real figure and is not touched. Anything
-- added to an invoice AFTER a maker was marked paid stays owed, which is why
-- this sets the fee and the add-ons rather than the ledger total: a line item
-- added later is a genuine balance and must survive this.
--
-- Idempotent: once a row has an amount it no longer matches. Forward-only
-- (CLAUDE.md rule 11).

UPDATE bookings
   SET amount_paid_cents = price_cents + COALESCE(addons_cents, 0)
 WHERE status = 'confirmed'
   AND COALESCE(amount_paid_cents, 0) = 0
   AND price_cents + COALESCE(addons_cents, 0) > 0;
