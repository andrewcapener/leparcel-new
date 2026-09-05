-- Priority placement, and the cap that goes with it.
--
-- `is_limited` was a boolean: it could say "limited" on the form and nothing
-- more. Priority placement is capped at a real number (5 indoor, 5 per outdoor
-- day, set by Drew on 5 Sep 2026), and overselling it means refunding makers
-- who were promised a spot at the front. So the cap is a number now.
--
-- NULL means uncapped, which is what every existing add-on is: `is_limited`
-- stays as the flag that renders the word "limited", and `capacity` is the
-- number that can actually be enforced. Nothing about the existing rows
-- changes.
ALTER TABLE add_ons ADD COLUMN IF NOT EXISTS capacity integer;

COMMENT ON COLUMN add_ons.capacity IS
  'How many of this add-on exist for the show. NULL means uncapped. For an outdoor add-on the cap is per day, because each day is its own space_type.';
