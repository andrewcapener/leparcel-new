-- Every space a booking occupies, instead of exactly one.
--
-- Drew, 26 Sept: "there are a handful of vendors who are gonna be outdoor
-- every single day, JC Beans and Alohana Acai, so I need to be able to grant
-- them access to all three days so that they show up on all three of the
-- outdoor days"; and, on the shape of it, "treat each and every one of our
-- days and inside spaces as like an a la carte product".
--
-- A booking held one space_type_id, and outdoors a space IS a day, so a maker
-- standing there three days could only ever be recorded as standing there
-- once. Hillary has been keeping the second day in a spreadsheet column
-- because the schema gave her nowhere to put it.
--
-- TWO THINGS ARE DELIBERATELY SEPARATE HERE, which is Drew's own framing:
-- what a maker has ACCESS to, and what she was INVOICED. price_cents null
-- means "covered by the fee already on the booking" and is what every
-- backfilled row gets, so this table can be added under ninety live bookings
-- without moving a cent. A number means an added space that costs extra and
-- appears as its own line on her invoice.
--
-- bookings.space_type_id and bookings.price_cents are untouched and still
-- mean what they meant: the space the booking was made for and the fee
-- snapshotted then. Fifty four places read them.
--
-- Voided, never deleted (rule 3): a day taken off a maker who already paid
-- for it has to be answerable in December.
--
-- Forward-only and idempotent (rule 11).

CREATE TABLE IF NOT EXISTS booking_spaces (
  id            text PRIMARY KEY,
  booking_id    text NOT NULL REFERENCES bookings(id),
  space_type_id text NOT NULL REFERENCES space_types(id),
  price_cents   integer,
  created_at    text NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::text,
  created_by    text NOT NULL DEFAULT 'staff',
  voided_at     text,
  voided_by     text,
  void_reason   text
);

CREATE INDEX IF NOT EXISTS booking_spaces_booking ON booking_spaces (booking_id);

-- A maker cannot hold the same day twice. Partial, so a voided row never
-- blocks somebody being put back on a day they were taken off.
CREATE UNIQUE INDEX IF NOT EXISTS booking_spaces_live
  ON booking_spaces (booking_id, space_type_id) WHERE voided_at IS NULL;

-- Every existing booking's current space, at no extra charge, so the table is
-- complete from the first minute and nothing has to special-case "bookings
-- that predate it".
INSERT INTO booking_spaces (id, booking_id, space_type_id, price_cents, created_by)
SELECT gen_random_uuid()::text, b.id, b.space_type_id, NULL, 'backfill 0055'
  FROM bookings b
 WHERE NOT EXISTS (
   SELECT 1 FROM booking_spaces s
    WHERE s.booking_id = b.id AND s.space_type_id = b.space_type_id
 );
