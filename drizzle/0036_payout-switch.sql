-- Whether makers are asked to set up how they get paid.
--
-- Drew, 21 Sept 2026: "Let's wait to send them this ... Get their payment now?
-- Ask for the payouts later?!"
--
-- Off, and off is the default, for two reasons that both point the same way.
--
-- Connect is not enabled on the Stripe account yet, and only the account owner
-- can do that. Until it is, every one of these buttons returns an error. A
-- control that cannot work is worse than no control.
--
-- And tomorrow the payment links go out with a 48 hour window. That page has
-- exactly one job. Stripe asks for a Social Security number during payout
-- onboarding, and a maker who meets that question in the same breath as a $280
-- invoice may stop and do neither. The fee has a deadline; the payout does not
-- bite until statements are approved in December.
--
-- So this exists to be turned on deliberately, at /admin/shows, once the fee
-- window has closed and Connect is live. Everything behind it is already
-- built; this is the date it happens, not whether.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS payout_setup text NOT NULL DEFAULT 'off';
