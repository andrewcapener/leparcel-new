-- Withdrawing a space without deleting it.
--
-- The boutique footprint was pulled on 5 Sep 2026, but 0005 could only delete
-- the row where nothing pointed at it. Anywhere a maker had already applied for
-- one, the row had to stay, and a row that stays is a row the application form
-- keeps offering. add_ons has had `is_active` since the beginning; space_types
-- never did, because until now no space had ever been withdrawn mid-season.
--
-- Safe to run twice.
ALTER TABLE space_types ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN space_types.is_active IS
  'False hides the space from the application form. Withdrawn spaces are deactivated rather than deleted so that an application which already chose one still resolves.';

UPDATE space_types SET is_active = false WHERE code = 'IN-BTQ' AND is_active;
