-- Venmo and Zelle, on the payment page.
--
-- Drew, 21 Sept 2026: the girls are "pretty excited about being able to use
-- Venmo and Zelle" and find it convenient for makers. Drew's call, after the
-- trade was laid out in full.
--
-- ON THE PAGE, NOT IN THE EMAIL, and that is the whole design.
--
-- Put a Venmo handle in an email staff compose and "Mermade sends payment
-- details by email" becomes true, which is exactly the shape of the scam that
-- takes $280 off forty makers: a spoofed message with somebody else's handle
-- in it. Keep the handles only on the booking's own page at our domain and the
-- rule a maker can be taught still holds, just reworded: we never send payment
-- details by email, and the only place to pay is your own link on the site.
-- Every string that used to promise we would never ask for Venmo has been
-- rewritten to that rule rather than left to contradict the page.
--
-- Empty means off, which is the same rule the onboarding call times follow. No
-- handle is invented here: the fields ship blank, the section does not appear,
-- and it starts working the moment somebody fills them in at /admin/show.
--
-- These payments are MANUAL. No webhook, no automatic confirmation: staff
-- match the payment and press Mark paid on the roster, which is audit-logged
-- as it already was. The note on the Venmo link is prefilled with the maker's
-- MM code so that matching is reading a code rather than guessing at a name.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS venmo_handle  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS zelle_contact text NOT NULL DEFAULT '';
