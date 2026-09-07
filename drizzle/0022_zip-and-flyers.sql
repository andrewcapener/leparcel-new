-- Two things Elise asked for on 7 Sep 2026, both so she can do her job:
--
--   "Lets add zip code to address in case I mail them flyers"
--   "Can you add 'I want flyers to promote (how many- 25 or 50?)'"
--
-- Nullable with defaults, so every application already submitted stays valid
-- and simply has neither. Added at the end of their tables, and appended to
-- the end of the Sheet's columns, so nothing that already exists moves.

ALTER TABLE vendors      ADD COLUMN IF NOT EXISTS postal_code   text NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS flyers_wanted text NOT NULL DEFAULT '';
