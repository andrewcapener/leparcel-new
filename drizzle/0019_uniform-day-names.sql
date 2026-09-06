-- Every day named the same way.

-- The hours note was typed a day at a time and read
--   Friday 13 November · Saturday 14th · Sunday 15th
-- so the schedule page listed one day in full and the next two in a shorthand
-- that drops the month. It is the first table a shopper reads on that page,
-- and the three rows are meant to be compared down the column.
--
-- The times are normalised in the same pass. "9 to 6pm" is what a person types
-- and tidyHoursNote() already prints it as "9am to 6pm", so this stores what
-- the site has been showing rather than leaving the two a step apart.
--
-- Guarded on the exact value, so hours edited at /admin/show are left alone.
UPDATE shows SET hours_note =
  'Friday 13 November, 9am to 6pm · Saturday 14 November, 9am to 5pm · Sunday 15 November, 9am to 5pm'
 WHERE hours_note = 'Friday 13 November, 9 to 6pm · Saturday 14th, 9am to 5pm · Sunday 15th, 9am to 5pm';
