import { eq, and, asc } from 'drizzle-orm'
import { db } from './index'
import { shows, addOns, type Show, type AddOn } from './schema'

/**
 * Migration-tolerant reads.
 *
 * Migrations are forward-only and applied by hand in Supabase (CLAUDE.md
 * rule 11), so there is always a window where deployed code is ahead of the
 * database. Selecting a column that does not exist yet throws, and because
 * every page on the site reads the Show record, that window would otherwise
 * be a full outage rather than a missing sentence.
 *
 * So the reads that touch anything migration 0002 added degrade instead of
 * throwing: the two Show notes come back empty and the add-on list comes
 * back empty until the migration has run. Nothing else changes.
 *
 * The fallback is remembered, so a database behind the code costs one failed
 * query a minute rather than one per request, but it EXPIRES. A warm server
 * that latched the fallback has to notice the migration when it lands, or it
 * would serve the degraded page until it happened to be recycled.
 */

const MISSING_COLUMN = '42703'
const MISSING_TABLE = '42P01'
/** How long to trust a fallback before probing the real schema again. */
const RECHECK_AFTER_MS = 60_000

export function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined
}

let showsPre0002Until = 0

/** The active Show, whether or not migration 0002 has run. */
export async function activeShow(): Promise<Show | undefined> {
  if (Date.now() >= showsPre0002Until) {
    try {
      const full = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
      showsPre0002Until = 0
      return full
    } catch (err) {
      if (pgCode(err) !== MISSING_COLUMN) throw err
      showsPre0002Until = Date.now() + RECHECK_AFTER_MS
      console.warn('[db] shows predates migration 0002; run drizzle/0002_addons-and-loadin.sql')
    }
  }
  const [row] = await db
    .select({
      id: shows.id, slug: shows.slug, numeral: shows.numeral, name: shows.name,
      season: shows.season, year: shows.year,
      venueName: shows.venueName, venueAddress: shows.venueAddress,
      startsOn: shows.startsOn, endsOn: shows.endsOn, hoursNote: shows.hoursNote,
      applicationsOpenAt: shows.applicationsOpenAt,
      applicationsCloseAt: shows.applicationsCloseAt,
      rosterAnnouncedOn: shows.rosterAnnouncedOn,
      commissionBps: shows.commissionBps,
      paymentWindowHours: shows.paymentWindowHours,
      indoorCapacity: shows.indoorCapacity, outdoorCapacity: shows.outdoorCapacity,
      isActive: shows.isActive, createdAt: shows.createdAt,
    })
    .from(shows)
    .where(eq(shows.isActive, true))
    .limit(1)
  return row ? { ...row, loadInNote: '', takedownNote: '' } : undefined
}

let addOnsMissingUntil = 0

/** Every active add-on for a show, or none if the table isn't there yet. */
export async function activeAddOns(showId: string): Promise<AddOn[]> {
  if (Date.now() < addOnsMissingUntil) return []
  try {
    const rows = await db.query.addOns.findMany({
      where: and(eq(addOns.showId, showId), eq(addOns.isActive, true)),
      orderBy: [asc(addOns.sortOrder)],
    })
    addOnsMissingUntil = 0
    return rows
  } catch (err) {
    const code = pgCode(err)

    // A column this code knows about that the database has not got yet.
    // Vercel deploys the moment a branch is pushed, so a schema change is
    // always live before anyone has run the migration, and Drizzle's
    // `findMany` selects every column it knows: one unmigrated column and
    // every query touching this table throws. That is what took /apply down
    // when `capacity` shipped ahead of drizzle/0004_addon-capacity.sql.
    //
    // Falling back to [] would be worse than the error, because the form
    // would quietly render with no add-ons at all and makers would apply
    // without them. So re-read the columns that certainly exist and treat the
    // new one as unset. The page keeps working, and the add-on that needs the
    // column is simply uncapped until the migration lands.
    if (code === MISSING_COLUMN) {
      addOnsMissingUntil = 0
      console.warn('[db] add_ons is missing a column this build expects; '
        + 'run drizzle/0004_addon-capacity.sql. Reading without it.')
      const rows = await db
        .select({
          id: addOns.id, showId: addOns.showId, track: addOns.track,
          code: addOns.code, name: addOns.name, description: addOns.description,
          priceCents: addOns.priceCents, maxQty: addOns.maxQty,
          isLimited: addOns.isLimited, sortOrder: addOns.sortOrder,
          isActive: addOns.isActive,
        })
        .from(addOns)
        .where(and(eq(addOns.showId, showId), eq(addOns.isActive, true)))
        .orderBy(asc(addOns.sortOrder))
      return rows.map((r) => ({ ...r, capacity: null }))
    }

    if (code !== MISSING_TABLE) throw err
    addOnsMissingUntil = Date.now() + RECHECK_AFTER_MS
    console.warn('[db] add_ons is missing; run drizzle/0002_addons-and-loadin.sql')
    return []
  }
}
