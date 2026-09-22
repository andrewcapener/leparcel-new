-- "I have sent it" for a Venmo or Zelle payment.
--
-- Drew, 22 Sept 2026: "when someone pays via venmo / zelle... just trying to
-- think how we reconcile in the backend."
--
-- The gap this closes: a maker who Venmos on Tuesday and a maker who has not
-- paid at all look exactly the same on the roster. Both read awaiting_payment,
-- because nothing about a Venmo reaches us. So staff either chase somebody who
-- already paid, or release the space of somebody who already paid, and the
-- second one is not recoverable by apologising.
--
-- The maker presses this at the moment they send the money, which is the one
-- piece of information only they have and the one moment they are willing to
-- give it. It turns the girls' job from searching an inbox for an unknown
-- payment into confirming a payment somebody has told them to expect.
--
-- It is NOT a payment and it never marks anything paid (rule 5): a button on a
-- web page is not evidence that money moved. It holds the space off the
-- release list and puts a flag on the row. A person still checks Venmo and
-- presses Mark paid.
--
-- Somebody could press it without sending anything. That trade is deliberate:
-- holding a space wrongly for a few days is undone with one click, and
-- releasing a maker who really did pay is not.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS said_sent_at  text,
  ADD COLUMN IF NOT EXISTS said_sent_via text;
