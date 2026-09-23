-- The provider's own id for a message we sent.
--
-- Drew, the night of the 22nd, minutes after scheduling the booth fee chase:
-- the greeting used the full name and he wanted the first name only. A
-- scheduled send can be cancelled, but only one message at a time and only by
-- the id Resend gave it, and this table did not keep them. The batch returns
-- one id per message and only the first was recorded, so sixty four of them
-- were unrecoverable from our own database and had to be found again by
-- listing the provider's account.
--
-- That is a bad way to find out. Anything scheduled for the future is a thing
-- somebody may need to stop, and the handle to stop it belongs next to the
-- record of sending it.
--
-- Nullable, with no backfill. Messages sent before this column existed have
-- no id here and never will; pretending otherwise would put a wrong handle on
-- a real row.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS provider_id text;
