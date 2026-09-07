-- When a maker might actually hear, as opposed to when the roster is public.
--
-- Elise, 7 Sep 2026: "you may hear from us as early as Sept 21 or as late as
-- Sep 24, please be patient and know we are working hard to curate a great
-- showcase!"
--
-- On the Show record rather than in the copy, because they are dates and
-- CLAUDE.md rule 6 says dates live here and are edited in /admin/show. The
-- jury will slip; this is the season these two dates change most.
--
-- Nullable. With neither set the thank-you screen simply does not make the
-- promise, which is the right default for a show nobody has scheduled a jury
-- for yet.

ALTER TABLE shows ADD COLUMN IF NOT EXISTS decisions_from_on text;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS decisions_to_on   text;

UPDATE shows
   SET decisions_from_on = COALESCE(decisions_from_on, '2026-09-21T12:00:00-07:00'),
       decisions_to_on   = COALESCE(decisions_to_on,   '2026-09-24T12:00:00-07:00')
 WHERE slug LIKE 'fall-2026%' OR name = 'Fall 2026';
