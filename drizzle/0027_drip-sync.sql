-- Whether each subscriber reached Drip, and why not.
--
-- The list lives HERE first and is pushed to Drip second, deliberately. Drew
-- wants off Drip soon; if Drip were the only place an address landed, leaving
-- means an export and a prayer. Holding the list ourselves makes the migration
-- a deleted function.
--
-- The columns exist because of sheet_syncs. That sync failed silently from the
-- day the site launched and nobody knew, because nothing recorded the failure.
-- A push with no state is a push you cannot audit, retry or count, so this one
-- gets state from the start.
--
-- Idempotent, and forward-only (CLAUDE.md rule 11).

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS drip_status text NOT NULL DEFAULT 'pending';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS drip_error  text NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS drip_synced_at text;

CREATE INDEX IF NOT EXISTS subscribers_drip_status ON subscribers (drip_status);
