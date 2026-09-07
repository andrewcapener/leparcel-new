-- sheet_syncs never actually existed in production.
--
-- 0003 created it, but 0003 is in the migration runner's BASELINE list in
-- src/db/migrate.ts: the files that predate the ledger, recorded as applied
-- without being run, on the assumption that `drizzle-kit push` had already
-- built them. For every other table in that list it had. For this one it had
-- not, so the ledger has said "applied" since the day it was written about a
-- table that was never there.
--
-- What that cost: syncApplication() queues into sheet_syncs before it posts,
-- and it is written never to throw, because a submission must never fail
-- because of Google. So every single application hit a missing relation,
-- swallowed it, and returned. No application has ever reached the Sheet from
-- production, and nothing said so, because the thing that would have said so
-- is the table.
--
-- Found because a DELETE against sheet_syncs failed in the Supabase editor
-- while clearing the rehearsal rows on opening day.
--
-- Identical to 0003 but idempotent, so it is a no-op on any database that did
-- get the original.

CREATE TABLE IF NOT EXISTS "sheet_syncs" (
  "application_id" text PRIMARY KEY NOT NULL REFERENCES "applications"("id"),
  "status" text DEFAULT 'pending' NOT NULL,
  "transport" text DEFAULT '' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text DEFAULT '' NOT NULL,
  "last_attempt_at" text,
  "next_attempt_at" text,
  "sent_at" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sheet_syncs_status" ON "sheet_syncs" ("status");
