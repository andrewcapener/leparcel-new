CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"track" text NOT NULL,
	"space_type_id" text,
	"category" text NOT NULL,
	"secondary_categories" text DEFAULT '[]' NOT NULL,
	"description" text NOT NULL,
	"price_low_cents" integer NOT NULL,
	"price_high_cents" integer NOT NULL,
	"made_by_you" text NOT NULL,
	"uses_ai_artwork" boolean DEFAULT false NOT NULL,
	"is_mlm" boolean DEFAULT false NOT NULL,
	"seller_permit" text DEFAULT '' NOT NULL,
	"occasional_seller" boolean DEFAULT false NOT NULL,
	"has_coi" boolean DEFAULT false NOT NULL,
	"photos" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score_quality" integer,
	"score_originality" integer,
	"score_brand" integer,
	"score_fit" integer,
	"jury_notes" text DEFAULT '' NOT NULL,
	"decided_at" text,
	"decided_by" text,
	"decline_reason" text,
	"terms_version" text DEFAULT '2026.1' NOT NULL,
	"signed_name" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"before" text,
	"after" text,
	"reason" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"application_id" text NOT NULL,
	"space_type_id" text NOT NULL,
	"vendor_code" text NOT NULL,
	"price_cents" integer NOT NULL,
	"commission_bps" integer NOT NULL,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"payment_due_at" text NOT NULL,
	"paid_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"template" text NOT NULL,
	"delivery_status" text DEFAULT 'logged' NOT NULL,
	"delivery_detail" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"numeral" text NOT NULL,
	"name" text NOT NULL,
	"season" text NOT NULL,
	"year" integer NOT NULL,
	"venue_name" text NOT NULL,
	"venue_address" text NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text NOT NULL,
	"hours_note" text DEFAULT '' NOT NULL,
	"applications_open_at" text NOT NULL,
	"applications_close_at" text NOT NULL,
	"roster_announced_on" text NOT NULL,
	"commission_bps" integer DEFAULT 2000 NOT NULL,
	"payment_window_hours" integer DEFAULT 48 NOT NULL,
	"indoor_capacity" integer DEFAULT 80 NOT NULL,
	"outdoor_capacity" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shows_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "space_types" (
	"id" text PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL,
	"track" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"capacity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'home' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_name" text NOT NULL,
	"legal_name" text,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"website" text,
	"instagram" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'CA' NOT NULL,
	"vendor_code" text,
	"shows_attended" integer DEFAULT 0 NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_space_type_id_space_types_id_fk" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_space_type_id_space_types_id_fk" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_types" ADD CONSTRAINT "space_types_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_show_status" ON "applications" USING btree ("show_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_show_vendor" ON "applications" USING btree ("show_id","vendor_id");--> statement-breakpoint
CREATE INDEX "audit_entity" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_show_vendor_code" ON "bookings" USING btree ("show_id","vendor_code");--> statement-breakpoint
CREATE INDEX "bookings_show_status" ON "bookings" USING btree ("show_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "space_types_show_code" ON "space_types" USING btree ("show_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_email" ON "vendors" USING btree ("email");