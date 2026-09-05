-- Drew's two decisions, 5 Sep 2026, and a way to stop them drifting.
--
-- JR spaces go to 8, not the 6 Elise's copy named. Spring 2026 ran eight of
-- them (MM21 to MM28), so 8 is the number the room actually holds.
--
-- That is exactly the problem worth fixing properly: the count was written
-- into the sentence AND stored in the capacity column, so moving one left the
-- other lying. Descriptions now write {{capacity}} and it is filled in at read
-- time from the column beside it (src/lib/counts.ts). One number, one place.
--
-- Safe to run twice.
UPDATE space_types SET capacity = 8 WHERE code = 'IN-JR';

UPDATE space_types
   SET description = 'For our makers 14 and under, to get them excited about being an entrepreneur. We provide the shelving. Only {{capacity}} chosen.'
 WHERE code = 'IN-JR';

UPDATE add_ons
   SET description = 'A spot on the busiest run of the room. Only {{capacity}} of these exist.'
 WHERE code = 'PRIORITY-IN';

UPDATE add_ons
   SET description = 'A tent near the entrance. Only {{capacity}} exist each day.'
 WHERE code = 'PRIORITY-OUT';
