-- Staggered load-in slots, asked on the application again.
--
-- The old Jotform asked "Choose your Set Up Time, as we will be staggering"
-- and the team used the answers to build an arrival schedule: 71 makers picked
-- 1-3pm, 51 picked 5-7pm, 23 picked 3-5pm, and 16 said any of the three. Our
-- form stopped asking, while the load-in note still promised "staggered
-- arrival slots", so staff had a promise and no data behind it.
--
-- The slots live on the Show record because the load-in window moves with the
-- venue, and are edited at /admin/show (CLAUDE.md rule 6).
--
-- Safe to run twice.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS load_in_slots text NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS load_in_slots text NOT NULL DEFAULT '[]';

COMMENT ON COLUMN shows.load_in_slots IS
  'Staggered arrival slots offered on the application, comma separated, e.g. "1-3pm, 3-5pm, 5-7pm". Empty hides the question.';
COMMENT ON COLUMN applications.load_in_slots IS
  'JSON array of the slot labels an indoor maker said they can make. Outdoor makers are not asked.';

-- The three the market has actually run, from the Spring 2026 responses.
UPDATE shows SET load_in_slots = '1-3pm, 3-5pm, 5-7pm' WHERE load_in_slots = '';
