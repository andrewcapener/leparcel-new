-- The roster moves to 25 September. Drew, 6 Sep 2026: official.

-- Five days after applications close rather than eight. Nothing in the code
-- carries the date, so this row is the whole change: the application page, the
-- FAQ, the maker's receipt and the agreement all read it from here.
--
-- Guarded on the value 0014 left, so an edit made at /admin/show in between is
-- not overwritten by a deploy.
UPDATE shows SET roster_announced_on = '2026-09-25T12:00:00-07:00'
 WHERE roster_announced_on = '2026-09-28T12:00:00-07:00';
