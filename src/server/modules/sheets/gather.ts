/**
 * The reads behind a sheet row: application + vendor + the show's catalog.
 *
 * Separate from row.ts so the mapping stays pure and testable, and separate
 * from sync.ts so the backfill script can gather many rows and post them
 * without re-querying the catalog once per application.
 *
 * Every function takes the db handle (CLAUDE.md rule 10).
 */
import { eq, inArray, asc } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { applications, vendors, spaceTypes, addOns } from '@/db/schema'
import { pgCode } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { applicationRow, type RowCatalog, type SheetRow } from './row'

export type DbHandle = typeof Db

/** Named columns rather than select(): a database one migration behind the
 *  deploy must not turn a sheet row into a 500 (same reasoning as
 *  src/db/queries.ts). */
const APP_COLUMNS = {
  id: applications.id,
  showId: applications.showId,
  vendorId: applications.vendorId,
  track: applications.track,
  category: applications.category,
  description: applications.description,
  priceLowCents: applications.priceLowCents,
  priceHighCents: applications.priceHighCents,
  madeByYou: applications.madeByYou,
  usesAiArtwork: applications.usesAiArtwork,
  isMlm: applications.isMlm,
  requestedSpaceIds: applications.requestedSpaceIds,
  requestedAddons: applications.requestedAddons,
  submittedAt: applications.submittedAt,
} as const

/**
 * The space and add-on names for one show. Add-ons live behind migration
 * 0002; a database without them yields an empty list and the row falls back to
 * printing the raw codes, which is worse-looking and still correct.
 */
export async function catalogFor(db: DbHandle, showId: string): Promise<RowCatalog> {
  const spaces = await db
    .select({ id: spaceTypes.id, label: spaceTypes.label })
    .from(spaceTypes)
    .where(eq(spaceTypes.showId, showId))

  let addonRows: Array<{ code: string; name: string }> = []
  try {
    addonRows = await db
      .select({ code: addOns.code, name: addOns.name })
      .from(addOns)
      .where(eq(addOns.showId, showId))
  } catch (err) {
    if (pgCode(err) !== '42P01' && pgCode(err) !== '42703') throw err
  }
  return { spaces, addons: addonRows }
}

/** One application as a sheet row, or undefined if it is not there. */
export async function gatherRow(db: DbHandle, applicationId: string): Promise<SheetRow | undefined> {
  const [app] = await db
    .select(APP_COLUMNS)
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1)
  if (!app) return undefined

  const [vendor] = await db
    .select({
      shopName: vendors.shopName,
      contactName: vendors.contactName,
      email: vendors.email,
      phone: vendors.phone,
      instagram: vendors.instagram,
      website: vendors.website,
      city: vendors.city,
      state: vendors.state,
    })
    .from(vendors)
    .where(eq(vendors.id, app.vendorId))
    .limit(1)
  if (!vendor) return undefined

  const catalog = await catalogFor(db, app.showId)
  return applicationRow({ application: app, vendor, catalog, siteUrl: siteUrl() })
}

/**
 * Every application for a show, oldest first, as sheet rows. Used by the
 * backfill: the sheet reads best in submission order.
 */
export async function gatherShowRows(db: DbHandle, showId: string): Promise<SheetRow[]> {
  const apps = await db
    .select(APP_COLUMNS)
    .from(applications)
    .where(eq(applications.showId, showId))
    .orderBy(asc(applications.submittedAt))
  if (apps.length === 0) return []

  const ids = [...new Set(apps.map((a) => a.vendorId))]
  const vendorRows = await db
    .select({
      id: vendors.id,
      shopName: vendors.shopName,
      contactName: vendors.contactName,
      email: vendors.email,
      phone: vendors.phone,
      instagram: vendors.instagram,
      website: vendors.website,
      city: vendors.city,
      state: vendors.state,
    })
    .from(vendors)
    .where(inArray(vendors.id, ids))
  const byId = new Map(vendorRows.map((v) => [v.id, v]))

  const catalog = await catalogFor(db, showId)
  const origin = siteUrl()

  return apps.flatMap((application) => {
    const vendor = byId.get(application.vendorId)
    return vendor ? [applicationRow({ application, vendor, catalog, siteUrl: origin })] : []
  })
}
