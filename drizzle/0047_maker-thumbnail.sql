-- The one square a shopper sees, chosen by staff.
--
-- Makers upload photographs with their application and those stay exactly as
-- they sent them. Some uploaded nothing, some uploaded something that does
-- not read at 170 pixels square, and Elise wants to fix both without
-- destroying what the maker actually sent.
--
-- So this is an OVERRIDE, not a replacement. Null means "use the first
-- photograph they uploaded", which is what every page did before this column
-- existed. Set, it wins. Clearing it restores the maker's own first photo,
-- because the maker's photos are never written over.
--
-- Forward-only and idempotent (CLAUDE.md rule 11).

ALTER TABLE applications ADD COLUMN IF NOT EXISTS thumbnail_url text;
