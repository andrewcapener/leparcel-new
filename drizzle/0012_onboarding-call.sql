-- The pre-show Zoom call, asked for on the application again.
--
-- The team runs short calls before each show on how to build a space that
-- sells, and they are well used: their sheet has a tab of sign-ups split into
-- inside and outside lists, with slots across five days in the October before
-- a November show. The old form asked who wanted in. Ours did not, so the list
-- was being assembled by hand from memory and email.
--
-- The call dates do not exist when someone applies, so this is interest only.
-- Staff schedule from the list once the dates are set.
--
-- Safe to run twice.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS wants_onboarding_call boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN applications.wants_onboarding_call IS
  'Wants a place on the pre-show Zoom call about display and making a space sell. Offered to both tracks and not gated on being a first-timer.';
