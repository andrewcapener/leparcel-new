-- Elise's own words for what each indoor space is for, 7 Sep 2026.
--
-- The application form now shows this line under the measurements, where it
-- used to live only on /makers/indoor. Elise: "I see you did that on the
-- indoor information link but I think ON THE APP is important too."
--
-- Matched on code rather than on the existing text, because production's rows
-- were seeded and then edited by hand and the old wording is not reliably what
-- this repository thinks it is. Two migrations have already tripped over that.
--
-- Idempotent: running it twice sets the same strings again.

UPDATE space_types SET description =
  'Not used for any sort of apparel. You have to be creative with vertical space.'
  WHERE code = 'IN-3x4';

UPDATE space_types SET description =
  'Our best seller, and it works for all sorts of goods.'
  WHERE code = 'IN-3x6';

UPDATE space_types SET description =
  'Great for apparel or artwork, and a lot of space. On a corner we usually run four feet on one side and four on the other, so there are plenty of ways to use it.'
  WHERE code = 'IN-3x8';

UPDATE space_types SET description =
  'Given out sparingly, and really for apparel only.'
  WHERE code = 'IN-3x12';
