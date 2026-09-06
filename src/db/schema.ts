import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Postgres schema — a faithful subset of docs/03-DATA-MODEL.md, run on
 * Supabase in production and any Postgres locally (DATABASE_URL).
 *
 * Timestamp convention: columns the app writes (show dates, deadlines,
 * paid_at…) are ISO-8601 strings in text columns, exactly as the app
 * produces them, so the SQLite-era call sites work unchanged. Columns the
 * database fills (created_at, submitted_at…) are timestamptz with a
 * defaultNow(), read back as strings. Both parse with new Date() and render
 * through src/lib/dates.ts in America/Los_Angeles (CLAUDE.md rule 8).
 */

const dbNow = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' }).notNull().defaultNow()

/* ───────────────────────── shows ─────────────────────────
 * NOTHING is hardcoded. Dates, prices, capacity, commission,
 * and the application window all live here (CLAUDE.md rule 6).
 */
export const shows = pgTable('shows', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  numeral: text('numeral').notNull(),            // "XXII"
  name: text('name').notNull(),                  // "Fall 2026"
  season: text('season', { enum: ['spring', 'fall'] }).notNull(),
  year: integer('year').notNull(),

  venueName: text('venue_name').notNull(),
  venueAddress: text('venue_address').notNull(),

  startsOn: text('starts_on').notNull(),         // ISO date, America/Los_Angeles
  endsOn: text('ends_on').notNull(),
  hoursNote: text('hours_note').notNull().default(''),

  // Load-in and take-down are prose, not dates: they move with the venue and
  // the staff edit them at /admin/show. Never hardcode them in a page.
  loadInNote: text('load_in_note').notNull().default(''),
  // Outside runs on its own clock: an outdoor maker books a single day and
  // sets up the morning of it, so the indoor note (the evening before the
  // doors open, in staggered slots) is not merely imprecise for them, it names
  // a day most of them are not there. Confirmed by Drew, 6 Sep 2026.
  outdoorLoadInNote: text('outdoor_load_in_note').notNull().default(''),
  // The staggered arrival slots offered on the application, comma separated,
  // e.g. "1-3pm, 3-5pm, 5-7pm". On the Show record because the load-in window
  // moves with the venue (CLAUDE.md rule 6) and staff edit it at /admin/show.
  loadInSlots: text('load_in_slots').notNull().default(''),
  takedownNote: text('takedown_note').notNull().default(''),

  applicationsOpenAt: text('applications_open_at').notNull(),
  applicationsCloseAt: text('applications_close_at').notNull(),
  rosterAnnouncedOn: text('roster_announced_on').notNull(),

  // money is integer cents, always
  commissionBps: integer('commission_bps').notNull().default(2000),   // 20.00%
  paymentWindowHours: integer('payment_window_hours').notNull().default(48),

  indoorCapacity: integer('indoor_capacity').notNull().default(80),
  outdoorCapacity: integer('outdoor_capacity').notNull().default(30),

  isActive: boolean('is_active').notNull().default(false),
  createdAt: dbNow('created_at'),
})

/* ───────────────────── space types (priced inventory) ───────────────────── */
export const spaceTypes = pgTable('space_types', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  track: text('track', { enum: ['indoor', 'outdoor'] }).notNull(),
  code: text('code').notNull(),                  // "IN-3x6"
  label: text('label').notNull(),                // "3x6", the name staff and returning makers use
  // "6ft wide, 3ft deep". Its own field because it is a fact about the space
  // and the description is advice about it, and the two are shown differently:
  // the size sits under the name as a subheading, the advice in its own
  // column. They were one string, which meant a page could show the size or
  // the advice but never both.
  dimensions: text('dimensions').notNull().default(''),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  capacity: integer('capacity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // Withdrawn spaces are deactivated, never deleted: an application that chose
  // one still has to resolve its space. The boutique footprint was pulled on
  // 5 Sep 2026 and this is what keeps it off the form.
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('space_types_show_code').on(t.showId, t.code)])

/* ───────────────────── add-ons (priced extras) ─────────────────────
 * docs/03-DATA-MODEL.md §6 — "kills the 'prices live in prose' problem".
 * A null track means the add-on is offered to both. Prices are the ones
 * the market has actually charged (share a space $100, endcap $40 indoor
 * and $60 outdoor, a Mermade tent $100).
 */
export const addOns = pgTable('add_ons', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  track: text('track', { enum: ['indoor', 'outdoor'] }),   // null = both
  code: text('code').notNull(),                  // 'SHARE' | 'ENDCAP' | 'TENT_10X10'
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  maxQty: integer('max_qty').notNull().default(1),
  isLimited: boolean('is_limited').notNull().default(false),
  // How many exist for the show. NULL is uncapped, which is every add-on that
  // predates priority placement. `isLimited` renders the word "limited" on the
  // form; this is the number staff can actually count against. For an outdoor
  // add-on the cap is per day, since each day is its own space type.
  capacity: integer('capacity'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [uniqueIndex('add_ons_show_code').on(t.showId, t.code)])

/* ───────────────────────── vendors ─────────────────────────
 * Persistent across shows. An application belongs to a vendor.
 */
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  shopName: text('shop_name').notNull(),
  legalName: text('legal_name'),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  website: text('website'),
  instagram: text('instagram').notNull().default(''),
  city: text('city').notNull().default(''),
  state: text('state').notNull().default('CA'),
  vendorCode: text('vendor_code'),               // "MM07" — assigned at acceptance
  showsAttended: integer('shows_attended').notNull().default(0),
  isFlagged: boolean('is_flagged').notNull().default(false),
  flagReason: text('flag_reason'),
  createdAt: dbNow('created_at'),
}, (t) => [uniqueIndex('vendors_email').on(t.email)])

export const CATEGORIES = [
  'Jewelry', 'Apparel', 'Home', 'Ceramics', 'Paper/Art', 'Bath & Body',
  'Kids', 'Candles', 'Leather', 'Vintage', 'Treats', 'Plants', 'Other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const APPLICATION_STATUSES = [
  'new', 'under_review', 'shortlist', 'accepted', 'waitlist', 'declined',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/* ─────────────────────── applications ─────────────────────── */
export const applications = pgTable('applications', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),

  track: text('track', { enum: ['indoor', 'outdoor', 'both'] }).notNull(),
  spaceTypeId: text('space_type_id').references(() => spaceTypes.id),
  // Every space the maker checked, as a JSON array of space_type ids. The
  // primary (first) one is what acceptance books; most makers check one,
  // outdoor makers often check several days, and roughly one in a hundred
  // wants both tracks.
  requestedSpaceIds: text('requested_space_ids').notNull().default('[]'),
  // Add-on codes the maker asked for, as a JSON array. A request, not a
  // sale: limited add-ons (endcaps) are granted at booking, and the money
  // only becomes real on the booking.
  requestedAddons: text('requested_addons').notNull().default('[]'),
  // Which load-in slots an indoor maker can make, as a JSON array of the
  // slot labels on the Show record. Load-in is staggered so a hundred shops
  // do not arrive at once; the old form asked this and ours had stopped, so
  // staff were assigning arrival times with nothing to assign them from.
  // Outdoor makers set up their own tent on their own day and are not asked.
  loadInSlots: text('load_in_slots').notNull().default('[]'),
  // Wants a place on the pre-show Zoom call about building a space that
  // sells. Mostly first-timers take it, but both tracks are offered it and
  // returning makers join too, so it is not gated on anything. The call dates
  // are set about a month out, long after this is asked, so the application
  // collects the interest and staff schedule from the list.
  wantsOnboardingCall: boolean('wants_onboarding_call').notNull().default(false),

  category: text('category').notNull(),
  secondaryCategories: text('secondary_categories').notNull().default('[]'), // JSON
  description: text('description').notNull(),
  priceLowCents: integer('price_low_cents').notNull(),
  priceHighCents: integer('price_high_cents').notNull(),

  // the questions the audit says to add now
  madeByYou: text('made_by_you', {
    enum: ['all', 'mostly_sourced_components', 'curate_resell'],
  }).notNull(),
  usesAiArtwork: boolean('uses_ai_artwork').notNull().default(false),
  isMlm: boolean('is_mlm').notNull().default(false),

  // compliance — closes audit §1.1 / §1.3
  // Whether they have a California seller's permit, asked on the application
  // of outdoor makers only. Not the number: the number is paperwork nobody has
  // to hand while they are applying, and it is collected after acceptance.
  // This is the planning signal, so staff know before the jury sits how many
  // 410-D declarations they will be chasing. 'unsure' is a real answer and
  // the most useful one, because it names who needs help.
  permitStatus: text('permit_status', { enum: ['have', 'occasional', 'unsure'] }),
  sellerPermit: text('seller_permit').notNull().default(''),
  occasionalSeller: boolean('occasional_seller').notNull().default(false),
  hasCoi: boolean('has_coi').notNull().default(false),

  photos: text('photos').notNull().default('[]'),  // JSON array of paths

  status: text('status').notNull().default('new'),
  submittedAt: dbNow('submitted_at'),

  // jury record
  scoreQuality: integer('score_quality'),
  scoreOriginality: integer('score_originality'),
  scoreBrand: integer('score_brand'),
  scoreFit: integer('score_fit'),
  juryNotes: text('jury_notes').notNull().default(''),
  decidedAt: text('decided_at'),
  decidedBy: text('decided_by'),
  declineReason: text('decline_reason'),

  termsVersion: text('terms_version').notNull().default('2026.1'),
  signedName: text('signed_name').notNull().default(''),
}, (t) => [
  index('applications_show_status').on(t.showId, t.status),
  uniqueIndex('applications_show_vendor').on(t.showId, t.vendorId),
])

/* ─────────────────────── bookings ───────────────────────
 * Created on acceptance. commission_bps is SNAPSHOTTED here and
 * immutable (CLAUDE.md rule 6) — changing the show rate later must
 * never retroactively change what a vendor was promised.
 */
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  applicationId: text('application_id').notNull().references(() => applications.id),
  spaceTypeId: text('space_type_id').notNull().references(() => spaceTypes.id),

  vendorCode: text('vendor_code').notNull(),      // "MM07"
  priceCents: integer('price_cents').notNull(),          // the space, before extras
  addonsCents: integer('addons_cents').notNull().default(0),
  commissionBps: integer('commission_bps').notNull(),   // immutable snapshot

  status: text('status', {
    enum: ['awaiting_payment', 'confirmed', 'forfeited', 'cancelled'],
  }).notNull().default('awaiting_payment'),
  paymentDueAt: text('payment_due_at').notNull(),
  paidAt: text('paid_at'),

  createdAt: dbNow('created_at'),
}, (t) => [
  uniqueIndex('bookings_show_vendor_code').on(t.showId, t.vendorCode),
  index('bookings_show_status').on(t.showId, t.status),
])

/* Extras actually bought, with the price snapshotted at booking time —
 * same reasoning as commission_bps. docs/03-DATA-MODEL.md §6. */
export const bookingAddons = pgTable('booking_addons', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  addOnId: text('add_on_id').notNull().references(() => addOns.id),
  qty: integer('qty').notNull().default(1),
  priceCents: integer('price_cents').notNull(),   // snapshot
}, (t) => [index('booking_addons_booking').on(t.bookingId)])

/* ─────────────────────── audit log ───────────────────────
 * CLAUDE.md rule 3 — every state change that touches money or a
 * vendor's standing is logged with actor, before, after, reason.
 */
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  entity: text('entity').notNull(),           // 'application' | 'booking'
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),           // 'status_change' | 'accept' | ...
  actor: text('actor').notNull(),
  before: text('before'),                     // JSON
  after: text('after'),                       // JSON
  reason: text('reason').notNull().default(''),
  at: dbNow('at'),
}, (t) => [index('audit_entity').on(t.entity, t.entityId)])

/* ─────────────────────── email outbox ───────────────────────
 * Every message the system sends is recorded here — the audit trail
 * behind /admin/outbox. Delivery itself is Resend (see mail() in
 * src/app/actions.ts); the row is written whether or not sending is
 * configured.
 */
export const emailOutbox = pgTable('email_outbox', {
  id: text('id').primaryKey(),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  template: text('template').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('logged'), // 'logged' | 'sent' | 'failed'
  deliveryDetail: text('delivery_detail').notNull().default(''),
  sentAt: dbNow('sent_at'),
})

/* ─────────────────────── Google Sheets sync ───────────────────────
 * One row per application, so a submission that could not reach the
 * owner's Sheet is queued rather than lost. The application is the unit
 * and its id is the primary key, which makes the record itself the
 * idempotency guard: an application has exactly one sync, retried in
 * place. Written by src/server/modules/sheets/*.
 *
 * last_error is redacted before it is stored — never an address, a phone
 * number, a URL that carries a secret, or key material (CLAUDE.md rule 9).
 */
export const sheetSyncs = pgTable('sheet_syncs', {
  applicationId: text('application_id').primaryKey().references(() => applications.id),
  status: text('status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
  transport: text('transport').notNull().default(''),   // 'sheets_api' | 'apps_script'
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error').notNull().default(''),
  lastAttemptAt: text('last_attempt_at'),
  nextAttemptAt: text('next_attempt_at'),
  sentAt: text('sent_at'),
  createdAt: dbNow('created_at'),
}, (t) => [index('sheet_syncs_status').on(t.status)])

/* ─────────────────────── newsletter ─────────────────────── */
export const subscribers = pgTable('subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('home'),
  createdAt: dbNow('created_at'),
})

export type Show = typeof shows.$inferSelect
export type SpaceType = typeof spaceTypes.$inferSelect
export type AddOn = typeof addOns.$inferSelect
export type Vendor = typeof vendors.$inferSelect
export type Application = typeof applications.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type SheetSync = typeof sheetSyncs.$inferSelect
