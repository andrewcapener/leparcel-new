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
 * back empty until the migration has run. Nothing else changes, and the
 * fallback is remembered so a cold database costs one failed query, not one
 * per request.
 */

const MISSING_COLUMN = '42703'
const MISSING_TABLE = '42P01'

function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined
}

let showsArePre0002 = false

/** The active Show, whether or not migration 0002 has run. */
export async function activeShow(): Promise<Show | undefined> {
  if (!showsArePre0002) {
    try {
      return await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
    } catch (err) {
      if (pgCode(err) !== MISSING_COLUMN) throw err
      showsArePre0002 = true
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

let addOnsTableMissing = false

/** Every active add-on for a show, or none if the table isn't there yet. */
export async function activeAddOns(showId: string): Promise<AddOn[]> {
  if (addOnsTableMissing) return []
  try {
    return await db.query.addOns.findMany({
      where: and(eq(addOns.showId, showId), eq(addOns.isActive, true)),
      orderBy: [asc(addOns.sortOrder)],
    })
  } catch (err) {
    if (pgCode(err) !== MISSING_TABLE) throw err
    addOnsTableMissing = true
    console.warn('[db] add_ons is missing; run drizzle/0002_addons-and-loadin.sql')
    return []
  }
}
