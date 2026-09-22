-- One deadline for everybody, instead of 48 hours from whenever Accept was
-- clicked.
--
-- Drew, 22 Sept 2026: "can we just move it to a fixed time?"
--
-- The rolling window started at ACCEPTANCE, not at the moment a maker was
-- told. Accept 78 people tonight, send the emails in the morning, and a maker
-- opens her link with under a day left on a clock she never saw start. A
-- fixed date is also one sentence the girls can write in every email rather
-- than a different date per maker.
--
-- payment_window_hours stays, as a FLOOR rather than the rule. A maker
-- accepted off the waitlist two days before the fixed date would otherwise
-- inherit a deadline that has already gone, so the due date is the later of
-- the two. Nobody ever gets less than the window.
--
-- Null means the old behaviour, which is what every show before this one had.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS payment_due_at text;
