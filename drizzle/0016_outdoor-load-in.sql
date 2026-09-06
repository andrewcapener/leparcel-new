-- Outside loads in the morning of their own day.

-- Load-in was one field, written for inside: the evening before the doors
-- open, in staggered slots. An outdoor maker books a single day and sets up
-- the morning of it, so that note names a day most of them are not there for.
-- Confirmed by Drew, 6 Sep 2026. The two tracks now carry their own.
--
-- The outdoor maker page had the right sentence typed into it as a literal,
-- which is the thing CLAUDE.md rule 6 exists to stop: it could not be edited
-- at /admin/show and it could not follow the venue. This is that sentence,
-- moved onto the record it belongs to.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS outdoor_load_in_note text NOT NULL DEFAULT '';

UPDATE shows SET outdoor_load_in_note = '7am on your day'
 WHERE outdoor_load_in_note = '';
