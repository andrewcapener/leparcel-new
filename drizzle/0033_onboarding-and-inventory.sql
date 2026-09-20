-- The rest of the maker's checklist: a call time to pick, and a date for the
-- item list.
--
-- Drew, 20 Sept 2026, from the Mermade Crew thread: "1. Payment 2. Zoom
-- selections 3. Inventory due date", with payment as the headline once a
-- maker signs in.
--
-- Two details from that thread are the reason these are settings and not
-- constants.
--
-- The times differ BY TRACK. Hillary's outdoor slots are "Not needed",
-- "Tues Oct 13 @ 6pm" and "Wed Oct 14 @ 9am"; the indoor ones do not exist
-- yet. So they are two independent lists, and a track whose list is empty
-- simply shows no call row rather than showing an empty question. That is
-- what lets the outdoor half ship tonight without waiting on the indoor
-- times.
--
-- Stored as text, one option per line, because the people who set them are
-- editing a textarea in the admin and these are labels rather than
-- timestamps: "Not needed" is a legitimate answer and is not a date at all.
-- Nothing in the app parses them, which is the point: no format to get wrong
-- and no timezone to mangle (rule 8 exists because that is where this breaks).
--
-- Inventory is INDOOR ONLY. Hillary, same thread: "don't do inventory for
-- outside ppl... we'll get a million questions!" The checklist already scopes
-- that row to makers who are not outdoor, because Mermade rings those sales
-- and an outdoor maker runs their own register. This adds the date that row
-- has never been able to name.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS onboarding_slots_indoor  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS onboarding_slots_outdoor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS inventory_due_at         text;

-- Which one the maker picked. On the booking rather than the application: it
-- is a fact about a maker who is coming, and an application that was declined
-- has no call to be on.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS onboarding_slot text;
