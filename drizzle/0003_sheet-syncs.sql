-- Durable state for the Google Sheets sync. One row per application, so a
-- submission that could not reach the Sheet is queued and retried rather than
-- lost. Forward-only (CLAUDE.md rule 11).
--
-- The primary key is the application id, which is also the idempotency key
-- carried in the sheet row: an application has exactly one sync record and
-- exactly one row in the Sheet, retried in place.
CREATE TABLE "sheet_syncs" (
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
CREATE INDEX "sheet_syncs_status" ON "sheet_syncs" ("status");
