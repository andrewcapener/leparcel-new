-- Load-in and take-down as editable prose on the Show record, so the maker
-- rules pages never hardcode a date (CLAUDE.md rule 6).
ALTER TABLE "shows" ADD COLUMN "load_in_note" text DEFAULT '' NOT NULL;
ALTER TABLE "shows" ADD COLUMN "takedown_note" text DEFAULT '' NOT NULL;

-- Priced extras. docs/03-DATA-MODEL.md §6 — the prices stop living in prose.
CREATE TABLE "add_ons" (
  "id" text PRIMARY KEY NOT NULL,
  "show_id" text NOT NULL REFERENCES "shows"("id"),
  "track" text,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price_cents" integer NOT NULL,
  "max_qty" integer DEFAULT 1 NOT NULL,
  "is_limited" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);
CREATE UNIQUE INDEX "add_ons_show_code" ON "add_ons" ("show_id", "code");

CREATE TABLE "booking_addons" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL REFERENCES "bookings"("id"),
  "add_on_id" text NOT NULL REFERENCES "add_ons"("id"),
  "qty" integer DEFAULT 1 NOT NULL,
  "price_cents" integer NOT NULL
);
CREATE INDEX "booking_addons_booking" ON "booking_addons" ("booking_id");

ALTER TABLE "bookings" ADD COLUMN "addons_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "applications" ADD COLUMN "requested_addons" text DEFAULT '[]' NOT NULL;
