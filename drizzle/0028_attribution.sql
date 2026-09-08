-- Where an applicant came from, counted by us.
--
-- Meta reports the conversions it believes it caused, and that number is
-- generous by construction. When the question is whether the ad spend was
-- worth it, the answer has to come from a count nobody is selling us.
--
-- Idempotent, forward-only (CLAUDE.md rule 11).
ALTER TABLE applications ADD COLUMN IF NOT EXISTS attribution text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS applications_attribution ON applications (attribution);
