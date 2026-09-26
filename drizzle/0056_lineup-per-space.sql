-- Placement and hiding move to the SPACE, not the booking.
--
-- 0055 let a maker hold several spaces, and outdoors a space is a day. The
-- lineup board now shows a three day maker three times, which is the point,
-- but order and visibility still lived on the booking, so dragging her Friday
-- card would have moved her Saturday one and hiding one day would have hidden
-- all three.
--
-- bookings.lineup_hidden_at STAYS and keeps its meaning: hold this maker back
-- from the public lineup entirely, wherever she appears. That is the control
-- on her own page, and it is a different question from "not on Sunday".
-- /makers hides a card when either one says so.
--
-- lineup_order is carried across so nothing Elise has already arranged moves.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE booking_spaces ADD COLUMN IF NOT EXISTS lineup_order integer;
ALTER TABLE booking_spaces ADD COLUMN IF NOT EXISTS lineup_hidden_at text;
ALTER TABLE booking_spaces ADD COLUMN IF NOT EXISTS lineup_hidden_by text;
ALTER TABLE booking_spaces ADD COLUMN IF NOT EXISTS lineup_hidden_reason text;

UPDATE booking_spaces s
   SET lineup_order = b.lineup_order
  FROM bookings b
 WHERE b.id = s.booking_id
   AND s.lineup_order IS NULL
   AND b.lineup_order IS NOT NULL;
