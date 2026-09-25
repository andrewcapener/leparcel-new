-- The order makers appear in on the public lineup.
--
-- Elise, 25 Sept, wants to reorder the grid. It has been alphabetical inside
-- each group since the page existed, which is a fine default and a poor
-- final answer: the first row is the one everybody sees, and who sits in it
-- is a curation decision, which is the thing this business is actually
-- selling.
--
-- Null means "wherever the default puts me". Postgres sorts NULLs last on an
-- ASC, so a maker nobody has placed falls in behind the placed ones and then
-- sorts the way she always did. That is what makes this safe to ship against
-- eighty eight rows nobody has touched.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lineup_order integer;
