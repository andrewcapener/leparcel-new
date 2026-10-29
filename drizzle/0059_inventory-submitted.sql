-- "This is my final list."
--
-- Drew, 29 October: a maker needs a way to say they are done, and that is
-- what should cross the item list off their to-do list.
--
-- Until now the checklist row ticked itself the moment a maker typed one
-- line, which is not the same thing at all. A maker with one line out of
-- forty read as finished, and nobody could tell the lists that were ready to
-- key in from the ones somebody was halfway through.
--
-- Not a lock. Drew, 27 October: "their inventory can change over time, people
-- add items and we should allow them to do that." Sending it is a signal, not
-- a door closing: they can still add and remove afterwards, and the Show's
-- inventory_due_at is what actually ends it.
--
-- Whether a list has CHANGED since it was sent needs no column of its own: an
-- item carries created_at and updated_at, so anything newer than this answers
-- it.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inventory_submitted_at text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inventory_submitted_by text;
