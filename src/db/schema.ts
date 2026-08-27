import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Prototype schema — a faithful subset of docs/03-DATA-MODEL.md.
 *
 * SQLite here so the prototype runs with zero setup. The column names, the
 * money-as-integer-cents rule, and the show_id scoping are identical to the
 * Postgres DDL in the spec, so porting is a dialect change, not a redesign.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`

/* ───────────────────────── shows ─────────────────────────
 * NOTHING is hardcoded. Dates, prices, capacity, commission,
 * and the application window all live here (CLAUDE.md rule 6).
 */
export const shows = sqliteTable('shows', {
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

  applicationsOpenAt: text('applications_open_at').notNull(),
  applicationsCloseAt: text('applications_close_at').notNull(),
  rosterAnnouncedOn: text('roster_announced_on').notNull(),

  // money is integer cents, always
  commissionBps: integer('commission_bps').notNull().default(2000),   // 20.00%
  paymentWindowHours: integer('payment_window_hours').notNull().default(48),

  indoorCapacity: integer('indoor_capacity').notNull().default(80),
  outdoorCapacity: integer('outdoor_capacity').notNull().default(30),

  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(now),
})

/* ───────────────────── space types (priced inventory) ───────────────────── */
export const spaceTypes = sqliteTable('space_types', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  track: text('track', { enum: ['indoor', 'outdoor'] }).notNull(),
  code: text('code').notNull(),                  // "IN-3x6"
  label: text('label').notNull(),                // "3' × 6' indoor space"
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  capacity: integer('capacity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [uniqueIndex('space_types_show_code').on(t.showId, t.code)])

/* ───────────────────────── vendors ─────────────────────────
 * Persistent across shows. An application belongs to a vendor.
 */
export const vendors = sqliteTable('vendors', {
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
  isFlagged: integer('is_flagged', { mode: 'boolean' }).notNull().default(false),
  flagReason: text('flag_reason'),
  createdAt: text('created_at').notNull().default(now),
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
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),

  track: text('track', { enum: ['indoor', 'outdoor', 'both'] }).notNull(),
  spaceTypeId: text('space_type_id').references(() => spaceTypes.id),

  category: text('category').notNull(),
  secondaryCategories: text('secondary_categories').notNull().default('[]'), // JSON
  description: text('description').notNull(),
  priceLowCents: integer('price_low_cents').notNull(),
  priceHighCents: integer('price_high_cents').notNull(),

  // the questions the audit says to add now
  madeByYou: text('made_by_you', {
    enum: ['all', 'mostly_sourced_components', 'curate_resell'],
  }).notNull(),
  usesAiArtwork: integer('uses_ai_artwork', { mode: 'boolean' }).notNull().default(false),
  isMlm: integer('is_mlm', { mode: 'boolean' }).notNull().default(false),

  // compliance — closes audit §1.1 / §1.3
  sellerPermit: text('seller_permit').notNull().default(''),
  occasionalSeller: integer('occasional_seller', { mode: 'boolean' }).notNull().default(false),
  hasCoi: integer('has_coi', { mode: 'boolean' }).notNull().default(false),

  photos: text('photos').notNull().default('[]'),  // JSON array of paths

  status: text('status').notNull().default('new'),
  submittedAt: text('submitted_at').notNull().default(now),

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
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  showId: text('show_id').notNull().references(() => shows.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  applicationId: text('application_id').notNull().references(() => applications.id),
  spaceTypeId: text('space_type_id').notNull().references(() => spaceTypes.id),

  vendorCode: text('vendor_code').notNull(),      // "MM07"
  priceCents: integer('price_cents').notNull(),
  commissionBps: integer('commission_bps').notNull(),   // immutable snapshot

  status: text('status', {
    enum: ['awaiting_payment', 'confirmed', 'forfeited', 'cancelled'],
  }).notNull().default('awaiting_payment'),
  paymentDueAt: text('payment_due_at').notNull(),
  paidAt: text('paid_at'),

  createdAt: text('created_at').notNull().default(now),
}, (t) => [
  uniqueIndex('bookings_show_vendor_code').on(t.showId, t.vendorCode),
  index('bookings_show_status').on(t.showId, t.status),
])

/* ─────────────────────── audit log ───────────────────────
 * CLAUDE.md rule 3 — every state change that touches money or a
 * vendor's standing is logged with actor, before, after, reason.
 */
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  entity: text('entity').notNull(),           // 'application' | 'booking'
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),           // 'status_change' | 'accept' | ...
  actor: text('actor').notNull(),
  before: text('before'),                     // JSON
  after: text('after'),                       // JSON
  reason: text('reason').notNull().default(''),
  at: text('at').notNull().default(now),
}, (t) => [index('audit_entity').on(t.entity, t.entityId)])

/* ─────────────────────── email outbox ───────────────────────
 * The prototype writes mail here instead of sending it, so you can
 * read exactly what a vendor would receive at /admin/outbox.
 */
export const emailOutbox = sqliteTable('email_outbox', {
  id: text('id').primaryKey(),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  template: text('template').notNull(),
  sentAt: text('sent_at').notNull().default(now),
})

/* ─────────────────────── newsletter ─────────────────────── */
export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('home'),
  createdAt: text('created_at').notNull().default(now),
})

export type Show = typeof shows.$inferSelect
export type SpaceType = typeof spaceTypes.$inferSelect
export type Vendor = typeof vendors.$inferSelect
export type Application = typeof applications.$inferSelect
export type Booking = typeof bookings.$inferSelect
