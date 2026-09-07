-- Applications close Monday 21 September, not Sunday the 20th.
--
-- Drew: "Header needs to say Applications Open until Sept 21", then Elise:
-- "applications are open 14 days. Monday to Monday... so that would be the
-- 21st". Both agree, so the record moves rather than the copy: the bar, the
-- apply page, both maker pages, the FAQ and the broadcast all read this field
-- and follow it on their own.
--
-- 11:59pm Pacific, matching the shape already stored and the promise every
-- page makes. Note this is the record disagreeing with itself before now: the
-- close was the 20th and the site has been saying the 20th all morning, to
-- everyone who has applied so far. Nobody is disadvantaged by the window
-- getting longer.
--
-- Matched on the show rather than on the old value, because production's dates
-- have been hand-edited before and two earlier migrations tripped over exactly
-- that. Idempotent.

UPDATE shows
   SET applications_close_at = '2026-09-21T23:59:00-07:00'
 WHERE is_active = true;
