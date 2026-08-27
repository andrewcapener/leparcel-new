# Data Model

Postgres. Written as annotated DDL — Claude Code should translate to Drizzle schema in `src/server/db/schema.ts` and generate migrations from there.

**Conventions:** `uuid` primary keys (`gen_random_uuid()`), `snake_case`, `created_at`/`updated_at` on everything, all money as `integer` **cents**, all timestamps `timestamptz` stored UTC.

---

## 1. Identity & access

```sql
-- Mirrors Supabase auth.users; app-level profile and role.
create type user_role as enum ('owner','staff','juror','register','vendor');

create table users (
  id            uuid primary key,              -- = auth.users.id
  email         citext not null unique,
  full_name     text,
  role          user_role not null default 'vendor',
  phone         text,
  mfa_enabled   boolean not null default false,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Immutable. Every financial or destructive action lands here.
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references users(id),
  action      text not null,                   -- 'payout.approve', 'statement.deduct', ...
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index on audit_log (entity_type, entity_id, created_at desc);
```

---

## 2. Shows — the spine

**Everything hangs off a show. No date, price, or capacity is hardcoded anywhere in the app.**

```sql
create type show_status as enum
  ('draft','applications_open','applications_closed','roster_live','in_progress','complete','archived');

create table shows (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,              -- 'Fall 2026'
  slug                  text not null unique,       -- 'fall-2026'
  status                show_status not null default 'draft',

  starts_on             date not null,              -- 2026-11-13
  ends_on               date not null,              -- 2026-11-15
  venue_name            text not null,
  venue_address         text not null,
  venue_map_url         text,

  applications_open_at  timestamptz,
  applications_close_at timestamptz,
  roster_announce_on    date,
  payment_window_hours  integer not null default 48, -- currently 36; see audit §2.3

  application_fee_cents integer not null default 0,  -- 0 = no fee (current policy)
  indoor_commission_bps integer not null default 2000, -- 20.00%
  outdoor_commission_bps integer not null default 0,

  terms_version         text not null,               -- FK-ish to legal_documents.version
  sales_tax_bps         integer,                     -- e.g. 775 = 7.75% Dana Point
  tax_inclusive_pricing boolean not null default false, -- ← CPA decision, audit §1.2

  hero_image_url        text,
  public_notes          text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per show-day. Outdoor is sold per day; hours differ per day.
create table show_days (
  id           uuid primary key default gen_random_uuid(),
  show_id      uuid not null references shows(id) on delete cascade,
  date         date not null,
  opens_at     time not null,                 -- 09:00
  closes_at    time not null,                 -- 18:00 Fri, 17:00 Sat/Sun
  food_trucks  text[],
  live_music   text,
  services     text[],                        -- acai, coffee, face painting, photo booth
  unique (show_id, date)
);

-- Staggered load-in windows with capacity.
create table loadin_slots (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid not null references shows(id) on delete cascade,
  track       track not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    integer not null,
  late_fee_cents integer not null default 10000   -- current $100 after 6pm
);
```

---

## 3. Sellable inventory (spaces)

```sql
create type track as enum ('indoor','outdoor');

-- The priced catalog for one show. Editable by Elise in admin.
create table space_types (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references shows(id) on delete cascade,
  track          track not null,
  code           text not null,                -- 'IN_3X6', 'OUT_FRI', 'JR'
  name           text not null,                -- '3ft x 6ft'
  description    text,
  price_cents    integer not null,             -- 28000
  capacity       integer not null,             -- how many exist
  per_day        boolean not null default false, -- outdoor sells per day
  show_day_id    uuid references show_days(id),  -- set when per_day
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  unique (show_id, code, show_day_id)
);

-- Optional extras. Kills the "prices live in prose" problem.
create table add_ons (
  id           uuid primary key default gen_random_uuid(),
  show_id      uuid not null references shows(id) on delete cascade,
  track        track,                          -- null = both
  code         text not null,                  -- 'TENT_10X10','TABLE_3X6','ENDCAP','TRAILER','SHARED'
  name         text not null,
  price_cents  integer not null,
  max_qty      integer not null default 1,
  is_active    boolean not null default true,
  unique (show_id, code)
);

-- Physical slots on the floor plan. 'MM34' lives here.
create table spaces (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references shows(id) on delete cascade,
  space_type_id  uuid not null references space_types(id),
  label          text not null,                -- 'MM34'
  x              numeric, y numeric, w numeric, h numeric,  -- floor plan coords
  is_corner      boolean not null default false,
  notes          text,
  unique (show_id, label)
);
```

---

## 4. Vendors — persistent across shows

```sql
create type vendor_status as enum ('prospect','active','flagged','banned');

create table vendors (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references users(id),
  vendor_code        text unique,                -- 'MM34' style, stable per vendor per show? see note
  shop_name          text not null,
  legal_name         text,
  contact_name       text not null,
  email              citext not null,
  phone              text,
  website            text,
  instagram          text,
  etsy               text,
  city               text, state text, country text default 'US',
  status             vendor_status not null default 'prospect',

  primary_category   text,
  secondary_categories text[],

  -- Compliance (audit §1.1, §1.3, §1.5)
  sellers_permit_number   text,
  sellers_permit_verified_at timestamptz,
  occasional_seller_410d  boolean not null default false,
  w9_document_id     uuid,
  coi_document_id    uuid,
  coi_expires_on     date,

  -- Stripe Connect
  stripe_account_id  text unique,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_requirements_due text[],

  internal_notes     text,
  first_show_id      uuid references shows(id),
  lifetime_gross_cents bigint not null default 0,   -- denormalized, recomputed nightly
  shows_attended     integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
> **Note on `vendor_code`:** the `MM##` code is currently a *floor position* code, reused between shows. Keep it that way — the code belongs to the **booking** (`bookings.vendor_code`), and `vendors.vendor_code` is a stable internal identifier. SKUs embed the booking's code so a tag is unambiguous within one show. Don't merge these two concepts; they diverge the moment a vendor moves booths between shows.

```sql
create type doc_type as enum ('w9','coi','sellers_permit','410d','health_permit','cottage_food','other');

create table documents (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  type        doc_type not null,
  storage_key text not null,                  -- private bucket
  filename    text, mime text, size_bytes integer,
  expires_on  date,
  verified_at timestamptz,
  verified_by uuid references users(id),
  created_at  timestamptz not null default now()
);
create index on documents (vendor_id, type);
create index on documents (expires_on) where expires_on is not null;
```

---

## 5. Applications & jurying

```sql
create type application_status as enum
  ('draft','submitted','under_review','awaiting_applicant','shortlisted',
   'accepted','waitlisted','declined','withdrawn','expired');

create table applications (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references shows(id) on delete cascade,
  vendor_id      uuid not null references vendors(id),
  status         application_status not null default 'draft',
  track_requested track[] not null,           -- {'indoor'} | {'outdoor'} | both

  product_description text,
  price_low_cents  integer,
  price_high_cents integer,
  handmade_level   text,      -- 'all_by_me' | 'sourced_components' | 'curated_resale'
  uses_ai_art      boolean,
  is_mlm           boolean,
  is_junior_maker  boolean not null default false,

  outdoor_fit_confirmed jsonb,      -- the 4 self-check answers
  shared_with_vendor_id uuid references vendors(id),

  requested        jsonb not null,  -- {space_type_id, qty, add_ons:[{code,qty}], days:[...]}
  quoted_total_cents integer not null default 0,

  terms_version    text,
  signed_at        timestamptz,
  signed_ip        inet,
  signed_user_agent text,

  application_fee_payment_id uuid,

  submitted_at     timestamptz,
  decided_at       timestamptz,
  decided_by       uuid references users(id),
  decline_reason_code text,
  decline_feedback text,
  waitlist_rank    integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, vendor_id)
);
create index on applications (show_id, status);

create table application_photos (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  storage_key    text not null,
  kind           text not null default 'product',   -- 'product' | 'booth'
  sort_order     integer not null default 0,
  width integer, height integer
);

-- One row per juror per application.
create table jury_scores (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  juror_id       uuid not null references users(id),
  quality        smallint check (quality between 1 and 5),
  originality    smallint check (originality between 1 and 5),
  branding       smallint check (branding between 1 and 5),
  fit            smallint check (fit between 1 and 5),
  note           text,
  created_at timestamptz not null default now(),
  unique (application_id, juror_id)
);

-- Encodes "we only select 1-3 makers per category" as a system rule.
create table category_caps (
  id        uuid primary key default gen_random_uuid(),
  show_id   uuid not null references shows(id) on delete cascade,
  track     track not null,
  category  text not null,
  cap       integer not null,
  unique (show_id, track, category)
);
```

---

## 6. Bookings

```sql
create type booking_status as enum
  ('pending_payment','confirmed','forfeited','cancelled','no_show','completed');

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references shows(id),
  vendor_id      uuid not null references vendors(id),
  application_id uuid references applications(id),
  track          track not null,
  status         booking_status not null default 'pending_payment',

  vendor_code    text not null,                -- 'MM34' — the tag code for THIS show
  space_id       uuid references spaces(id),
  space_type_id  uuid not null references space_types(id),
  show_day_ids   uuid[],                       -- outdoor: which days

  subtotal_cents integer not null,
  addons_cents   integer not null default 0,
  total_cents    integer not null,
  amount_paid_cents integer not null default 0,

  payment_due_at timestamptz,
  paid_at        timestamptz,
  forfeited_at   timestamptz,

  commission_bps integer not null,             -- snapshot at booking; never read live from shows
  loadin_slot_id uuid references loadin_slots(id),
  vehicle_info   text,
  notes          text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, vendor_code)
);
create index on bookings (show_id, status);

create table booking_addons (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  add_on_id   uuid not null references add_ons(id),
  qty         integer not null default 1,
  price_cents integer not null                 -- snapshot
);
```
> **`commission_bps` is snapshotted onto the booking.** If the rate changes mid-season, already-booked vendors keep the rate they agreed to. Reading it live from `shows` is the classic way to get sued.

---

## 7. Onboarding checklist

```sql
create type checklist_status as enum ('not_started','in_progress','submitted','complete','waived','overdue');

-- Per-show template, editable in admin.
create table checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid not null references shows(id) on delete cascade,
  track       track not null,
  code        text not null,           -- 'inventory_upload','coi','w9','stripe_connect',...
  title       text not null,
  description text,
  is_blocking boolean not null default false,   -- blocks booth confirmation
  blocks_payout boolean not null default false,
  due_offset_days integer,                      -- relative to show start, negative = before
  sort_order  integer not null default 0,
  unique (show_id, track, code)
);

create table checklist_items (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  template_id  uuid not null references checklist_templates(id),
  status       checklist_status not null default 'not_started',
  document_id  uuid references documents(id),
  value        jsonb,
  due_on       date,
  completed_at timestamptz,
  completed_by uuid references users(id),
  unique (booking_id, template_id)
);
```

---

## 8. Inventory & labels

> **Revised Aug 19.** No barcodes, no generated SKUs, no label PDFs. Tags are `MM##` + price; a vendor has 6–20 items. `items` rows are **optional enrichment** — a sale line only needs a `booking_id` (from the vendor code) and a price. `label_batches` is dropped entirely. See `07-POS-BUILD.md`.

```sql
create table items (
  id           uuid primary key default gen_random_uuid(),
  show_id      uuid not null references shows(id),
  booking_id   uuid not null references bookings(id) on delete cascade,
  vendor_id    uuid not null references vendors(id),
  sku          text,                        -- optional, vendor's own if they have one
  name         text not null,
  description  text,
  category     text,
  variant      text,
  price_cents  integer not null,
  qty_supplied integer not null,
  qty_sold     integer not null default 0,
  qty_returned integer not null default 0,
  photo_url    text,
  is_taxable   boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on items (booking_id);
-- Primary register lookup: given a vendor code and a price, find candidate items.
create index on items (booking_id, price_cents);

create table inventory_uploads (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  filename    text, row_count integer, error_count integer,
  errors      jsonb,
  committed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- label_batches: DROPPED. No generated labels; vendors tag by hand as they do today.
```

---

## 9. Sales

```sql
create type sale_status as enum ('open','completed','voided','refunded','partially_refunded');
create type tender_type as enum ('card_present','card_online','cash','other');

create table registers (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid not null references shows(id) on delete cascade,
  name        text not null,                  -- 'Register 1'
  stripe_terminal_reader_id text,
  last_seen_at timestamptz,
  is_online   boolean not null default false
);

create table sales (
  id              uuid primary key default gen_random_uuid(),
  show_id         uuid not null references shows(id),
  register_id     uuid references registers(id),
  staff_id        uuid references users(id),
  client_uuid     text not null,               -- ← idempotency key generated on the tablet
  status          sale_status not null default 'open',

  subtotal_cents  integer not null default 0,
  discount_cents  integer not null default 0,
  tax_cents       integer not null default 0,
  total_cents     integer not null default 0,

  stripe_payment_intent_id text,
  transfer_group  text,                        -- 'show_fall26_sale_<id>'
  receipt_email   text, receipt_phone text,

  was_offline     boolean not null default false,
  occurred_at     timestamptz not null,        -- device time of sale
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (show_id, client_uuid)                -- ← makes offline replay safe
);
create index on sales (show_id, occurred_at);

create table sale_lines (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references sales(id) on delete cascade,
  item_id         uuid references items(id),      -- null for MISC / UNATTRIBUTED
  vendor_id       uuid references vendors(id),    -- null only for UNATTRIBUTED
  booking_id      uuid references bookings(id),
  sku             text,
  name            text not null,
  qty             integer not null default 1,
  unit_price_cents integer not null,
  discount_cents  integer not null default 0,     -- apportioned share of cart discount
  tax_cents       integer not null default 0,
  line_total_cents integer not null,
  commission_bps  integer not null,               -- snapshot from booking
  commission_cents integer not null,
  net_to_vendor_cents integer not null,
  is_unattributed boolean not null default false,
  resolved_at     timestamptz,
  resolved_by     uuid references users(id)
);
create index on sale_lines (vendor_id);
create index on sale_lines (item_id);

create table tenders (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references sales(id) on delete cascade,
  type          tender_type not null,
  amount_cents  integer not null,
  cash_given_cents integer, cash_change_cents integer,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  captured_at   timestamptz
);

create table refunds (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references sales(id),
  sale_line_id  uuid references sale_lines(id),
  amount_cents  integer not null,
  reason        text,
  stripe_refund_id text,
  staff_id      uuid references users(id),
  created_at    timestamptz not null default now()
);
```
> **`sales.client_uuid` + the unique constraint is the whole offline story.** The tablet mints a UUID before the sale exists server-side. Replaying a queued batch twice is a no-op. Do not skip this.

---

## 10. Statements & payouts

```sql
create type statement_status as enum ('draft','ready','vendor_review','disputed','approved','paid','void');

create table statements (
  id              uuid primary key default gen_random_uuid(),
  show_id         uuid not null references shows(id),
  vendor_id       uuid not null references vendors(id),
  booking_id      uuid not null references bookings(id),
  status          statement_status not null default 'draft',
  version         integer not null default 1,

  gross_cents     integer not null default 0,
  discounts_cents integer not null default 0,
  refunds_cents   integer not null default 0,
  net_sales_cents integer not null default 0,
  commission_bps  integer not null,
  commission_cents integer not null default 0,
  deductions_cents integer not null default 0,
  adjustments_cents integer not null default 0,
  payout_cents    integer not null default 0,

  items_sold      integer not null default 0,
  generated_at    timestamptz,
  vendor_notified_at timestamptz,
  review_closes_at timestamptz,
  approved_at     timestamptz,
  approved_by     uuid references users(id),
  paid_at         timestamptz,
  void_reason     text,
  unique (show_id, vendor_id, version)
);

create table statement_adjustments (
  id            uuid primary key default gen_random_uuid(),
  statement_id  uuid not null references statements(id) on delete cascade,
  code          text not null,        -- 'label_noncompliance','jewelry_packaging','late_loadin','goodwill'
  description   text not null,
  amount_cents  integer not null,     -- negative = deduction
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now()
);

create type payout_status as enum ('pending','processing','paid','failed','reversed');

create table payouts (
  id              uuid primary key default gen_random_uuid(),
  statement_id    uuid not null references statements(id),
  vendor_id       uuid not null references vendors(id),
  amount_cents    integer not null,
  status          payout_status not null default 'pending',
  stripe_transfer_id text unique,
  stripe_payout_id   text,
  idempotency_key text not null unique,     -- 'payout:{statement_id}:v{version}'
  failure_code    text, failure_message text,
  approved_by     uuid not null references users(id),
  approved_at     timestamptz not null,
  initiated_at    timestamptz,
  settled_at      timestamptz
);

-- Booth fees, application fees, sponsorships — money coming IN.
create type payment_purpose as enum ('booth_fee','application_fee','addon','sponsorship','other');

create table payments (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid references shows(id),
  vendor_id     uuid references vendors(id),
  booking_id    uuid references bookings(id),
  purpose       payment_purpose not null,
  amount_cents  integer not null,
  fee_cents     integer,
  status        text not null,                -- mirrors Stripe PI status
  stripe_payment_intent_id text unique,
  method        text,                         -- 'card' | 'us_bank_account'
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
```

---

## 11. Content

```sql
create table pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  seo_title   text, seo_description text, og_image_url text,
  status      text not null default 'draft',   -- draft | published
  published_at timestamptz,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

create table content_blocks (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  type        text not null,      -- hero|rich_text|image|gallery|stat_row|faq_list|maker_cards|cta|quote
  data        jsonb not null,
  sort_order  integer not null default 0
);

create table page_revisions (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  snapshot    jsonb not null,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create table journal_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text,
  body        jsonb not null,
  hero_image_url text,
  tags        text[],
  vendor_id   uuid references vendors(id),      -- links Meet the Maker → vendor record
  author      text,
  status      text not null default 'draft',
  published_at timestamptz,
  legacy_url  text                              -- '/blogs/journal/meet-the-maker-...' for 301s
);

create table faqs (
  id        uuid primary key default gen_random_uuid(),
  audience  text not null,          -- 'shopper' | 'merchant'
  question  text not null,
  answer    jsonb not null,
  sort_order integer not null default 0,
  is_published boolean not null default true
);

create table media (
  id          uuid primary key default gen_random_uuid(),
  storage_key text not null,
  url         text not null,
  alt         text,
  width integer, height integer, mime text, size_bytes integer,
  tags        text[],
  uploaded_by uuid references users(id),
  created_at  timestamptz not null default now()
);

create table site_settings (
  key         text primary key,       -- 'announcement_bar','social_links','stat_row'
  value       jsonb not null,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

create table legal_documents (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,          -- 'vendor_agreement' | 'privacy' | 'terms'
  version     text not null,
  body        text not null,
  effective_on date not null,
  unique (kind, version)
);
```

---

## 12. Ops

```sql
create table email_events (
  id          uuid primary key default gen_random_uuid(),
  template    text not null,
  to_email    citext not null,
  vendor_id   uuid references vendors(id),
  show_id     uuid references shows(id),
  provider_id text,
  status      text,                   -- queued|sent|delivered|opened|bounced|complained
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table stripe_events (
  id           text primary key,       -- Stripe event id — dedupe key
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text
);

create table feature_flags (
  key        text primary key,
  enabled    boolean not null default false,
  show_id    uuid references shows(id),
  notes      text
);

create table contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name text, email citext, subject text, body text,
  kind       text,                     -- 'general' | 'sponsorship' | 'press'
  handled_by uuid references users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

## 13. Derived views worth materializing

```sql
-- Live sales per vendor. Refresh every 30s during a show, or make it a plain
-- view first and only materialize if it's actually slow.
create view v_vendor_live_sales as
select b.show_id, b.vendor_id, b.vendor_code,
       count(distinct sl.sale_id)          as transactions,
       sum(sl.qty)                         as units,
       sum(sl.line_total_cents)            as gross_cents,
       sum(sl.commission_cents)            as commission_cents,
       sum(sl.net_to_vendor_cents)         as net_cents
from bookings b
join sale_lines sl on sl.booking_id = b.id
join sales s on s.id = sl.sale_id and s.status = 'completed'
group by b.show_id, b.vendor_id, b.vendor_code;

-- Compliance matrix for the admin red list.
create view v_booking_compliance as
select b.id as booking_id, b.show_id, b.vendor_id, b.vendor_code,
       bool_and(ci.status in ('complete','waived'))
         filter (where ct.is_blocking)      as clear_to_confirm,
       bool_and(ci.status in ('complete','waived'))
         filter (where ct.blocks_payout)    as clear_to_pay,
       count(*) filter (where ci.status = 'overdue') as overdue_count
from bookings b
join checklist_items ci on ci.booking_id = b.id
join checklist_templates ct on ct.id = ci.template_id
group by b.id;
```

---

## 14. Invariants to enforce and test

1. For any completed sale: `sum(sale_lines.line_total_cents) - discount + tax = sales.total_cents`, exactly.
2. For any sale line: `commission_cents + net_to_vendor_cents = line_total_cents - discount_cents`, exactly. Rounding goes to **commission** (the house absorbs the sub-cent), never to the vendor, and never disappears.
3. `statements.payout_cents = net_sales - commission + adjustments`, and equals the sum of its source lines.
4. A statement cannot move to `approved` unless `v_booking_compliance.clear_to_pay` and `vendors.stripe_payouts_enabled`.
5. A payout row can never exist twice for the same `(statement_id, version)` — the unique idempotency key enforces it.
6. `bookings.commission_bps` is written once at booking creation and is immutable thereafter.
7. `items.qty_sold <= items.qty_supplied` unless explicitly overridden (a vendor restocking mid-show must update `qty_supplied`, not silently oversell). Only enforced where the vendor supplied a quantity — item lists are optional.
8. No `sale_lines` row may have `vendor_id is null` and `is_unattributed = false`.
9. **A `sale_lines` row is valid with `item_id is null` as long as it has a `booking_id` and a price.** This is the tier-1 path and it must never be treated as an error state — it's the normal case for any vendor who didn't add an item list.
