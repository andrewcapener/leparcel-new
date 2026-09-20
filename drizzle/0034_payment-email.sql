-- The payment email, on its own switch.
--
-- Drew, 21 Sept 2026: "why don't I just automate a payment email to go out to
-- each of them right after?"
--
-- Separate from decision_emails on purpose, because they are two different
-- jobs and the team only objected to one of them. The acceptance email opens
-- "You're in" and is the warm one they asked to write themselves. This is the
-- receipt: the space, the fee, the deadline, and a button. Sending it takes
-- nothing away from them.
--
-- Default off, same reasoning as every other switch here: turning automation
-- ON should always be somebody's decision, and the reverse default means one
-- forgotten checkbox mails the whole roster.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS payment_email text NOT NULL DEFAULT 'off';

-- When it went, so a resend is a deliberate act and a double-accept is not a
-- second email. Nullable: every booking before this has never had one.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS fee_email_at text;
