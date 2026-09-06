-- We choose the priority spot, and the add-on now says so.

-- Elise, 6 Sep 2026, after Hillary asked what the add-on was: "let's just say
-- that in the footnote (we choose which priority seat is best for your shop
-- brand)". The alternative on the table was letting a maker pick from a map,
-- which Drew ruled out before applications and which would have to be a
-- separate "choose your seating" step after acceptance anyway.
--
-- So the description carries the whole deal: what it buys, how few exist, and
-- who decides. A maker paying $100 for placement should not find out at load-in
-- that the choosing was ours.
--
-- {{capacity}} is left alone. It resolves from the capacity column at render
-- (src/lib/counts.ts), so the count on the page cannot drift from the cap.
UPDATE add_ons SET description =
  'A spot on the busiest run of the room. Only {{capacity}} of these exist, and we choose the one that suits your shop best.'
 WHERE code = 'PRIORITY-IN'
   AND description = 'A spot on the busiest run of the room. Only {{capacity}} of these exist.';

UPDATE add_ons SET description =
  'A tent near the entrance. Only {{capacity}} exist each day, and we choose the one that suits your shop best.'
 WHERE code = 'PRIORITY-OUT'
   AND description = 'A tent near the entrance. Only {{capacity}} exist each day.';
