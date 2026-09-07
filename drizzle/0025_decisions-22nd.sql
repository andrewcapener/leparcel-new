-- Decisions go out 22 to 24 September, not 21 to 24.
--
-- Drew, 7 Sep 2026: "so they'll hear from us between sept 22 and sept 24th,
-- we announce makers on the 25th."
--
-- The 21st stopped being possible the moment applications moved to close at
-- 11:59pm that night (0024). A thank-you screen promising a maker they might
-- hear on the 21st, while the form is still open until midnight on the 21st,
-- is the site contradicting itself to the person least able to shrug it off.
--
-- Idempotent, and matched on the active show rather than on the old value.

UPDATE shows
   SET decisions_from_on = '2026-09-22T12:00:00-07:00',
       decisions_to_on   = '2026-09-24T12:00:00-07:00'
 WHERE is_active = true;
