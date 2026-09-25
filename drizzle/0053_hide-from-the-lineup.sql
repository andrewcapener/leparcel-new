-- Keep a maker off the public lineup without taking their space away.
--
-- Drew, 25 Sept: "they want to remove Maddy from the makers page for now.
-- I think there's a chance of that person pays but hasn't yet."
--
-- The only tool for this was cancelBooking, which is the wrong one: it hands
-- the space back to the pool and stops the pay link taking money. For a maker
-- who might still pay that is a door slammed, not a curtain drawn.
--
-- So: a curtain. The booking is untouched, the space is still held, the pay
-- link still works, and /makers simply does not list them. Clearing it puts
-- them back with no other consequence.
--
-- Who and why, like every other reversible thing here (rule 3), because in
-- November somebody will ask why a maker who is standing at the show was
-- never on the website.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lineup_hidden_at text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lineup_hidden_by text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lineup_hidden_reason text;
