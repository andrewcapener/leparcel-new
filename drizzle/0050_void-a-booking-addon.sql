-- Take an add-on off an invoice without losing that it was ever on it.
--
-- Hillary changed Kelly's Outdoor Friday fee to $850 and Kelly's page still
-- said $950. The $100 was a tent rental, sitting on the booking as an add-on,
-- and there was no way to see it on the roster let alone take it off. Charge
-- lines have had voided_at since 0045; add-ons never did, so the one kind of
-- line staff most often need to remove was the one kind they could not.
--
-- Voided, never deleted (CLAUDE.md rule 3). A maker who paid $950 and is
-- refunded $100 has to be answerable in December, and a deleted row answers
-- nothing. boothInvoice leaves voided rows out of the arithmetic and the
-- detail page still lists them, with who took it off and why.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE booking_addons ADD COLUMN IF NOT EXISTS voided_at text;
ALTER TABLE booking_addons ADD COLUMN IF NOT EXISTS voided_by text;
ALTER TABLE booking_addons ADD COLUMN IF NOT EXISTS void_reason text;
