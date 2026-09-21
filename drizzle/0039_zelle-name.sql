-- The name Zelle shows for the market, so its QR can be generated.
--
-- Drew sent the bank's own Zelle code on 21 Sept 2026. Decoding it showed a
-- plain, documented payload rather than anything bank specific:
--
--   https://enroll.zellepay.com/qr-codes?data=<base64 {"token","name"}>
--
-- So this needs no uploaded image and no stored file. The token is the Zelle
-- contact already on the Show; the name is the only part that cannot be
-- guessed, because it is the registered account name rather than the market's
-- own ("MERMADE MARKET LLC Accounts"), and a wrong one would show a maker a
-- recipient that does not match the market.
--
-- Empty means no Zelle QR is drawn. The contact alone still renders, because
-- typing a phone number into a bank app is the path that always works.
--
-- Unlike Venmo, a Zelle code carries NO amount and NO note. The payload their
-- bank produced has two fields and this generates exactly those two rather
-- than inventing a third: a code that fails to scan is worse than one that
-- makes the maker type the amount, which the page already asks them to do.
--
-- Forward-only and idempotent (rule 11).

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS zelle_name text NOT NULL DEFAULT '';
