-- Two things the Show record was still carrying.
--
-- 1 · En dashes. Staff typed the show hours at /admin/show on a phone, and a
--     phone turns a typed hyphen into an en dash by itself, so the live site
--     read "Friday 13 November, 9 – 6pm". Drew asked for none of those
--     anywhere. New saves are cleaned on the way in (src/lib/dashes.ts), but
--     the value already stored was written before that existed, and the
--     guarded UPDATE in 0005 deliberately left staff edits alone.
--
--     Only the dash changes. A dash between two things in this field is always
--     a range, so it becomes "to", exactly as plainDashes() does it.
--
-- 2 · The load-in note said "in staggered arrival slots", and the set-up row
--     on /makers/indoor now says "time slot chosen in the application" itself,
--     so the two together said the same thing twice.
--
-- Safe to run twice.
UPDATE shows SET
  hours_note    = regexp_replace(regexp_replace(hours_note,    '\s*[‐-―−]\s*', ' to ', 'g'), '\s+', ' ', 'g'),
  load_in_note  = regexp_replace(load_in_note,  '\s*[‒–—―−]\s*', ' to ', 'g'),
  takedown_note = regexp_replace(takedown_note, '\s*[‒–—―−]\s*', ' to ', 'g'),
  venue_name    = regexp_replace(venue_name,    '\s*[‒–—―−]\s*', ' to ', 'g'),
  venue_address = regexp_replace(venue_address, '\s*[‒–—―−]\s*', ' to ', 'g')
WHERE hours_note    ~ '[‒–—―−]'
   OR load_in_note  ~ '[‒–—―−]'
   OR takedown_note ~ '[‒–—―−]'
   OR venue_name    ~ '[‒–—―−]'
   OR venue_address ~ '[‒–—―−]';

UPDATE shows SET load_in_note = 'Thursday 12 November, 1-7pm'
 WHERE load_in_note = 'Thursday 12 November, 1-7pm, in staggered arrival slots';
