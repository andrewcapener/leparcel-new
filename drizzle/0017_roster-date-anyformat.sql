-- 0015 did not take on production. This is the same change, matched properly.

-- 0015 moved the roster to 25 September with the guard
--   WHERE roster_announced_on = '2026-09-28T12:00:00-07:00'
-- which is the exact string the seed writes. Production never got its value
-- from the seed: 28 September was pasted into the Supabase editor by hand,
-- in whatever shape was typed that day, so the guard matched no rows and the
-- UPDATE silently did nothing. The deploy went green and the live site went on
-- telling makers the roster comes out on the 28th.
--
-- Two lessons, both worth the comment. A guarded UPDATE that matches nothing
-- is indistinguishable from a guarded UPDATE that did its job, so a guard has
-- to be written against the value that is really there, not the value the code
-- would have written. And a hand-pasted row keeps diverging long after the
-- paste: this is the second migration to trip over that same one.
--
-- Matching on the day rather than the timestamp catches any format, and is
-- still a guard: a roster moved to some other date at /admin/show is left
-- alone, and this is a no-op everywhere 0015 already worked.
UPDATE shows SET roster_announced_on = '2026-09-25T12:00:00-07:00'
 WHERE roster_announced_on LIKE '2026-09-28%';
