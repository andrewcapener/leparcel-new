import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { bookings, inventoryBreaks, inventoryItems, spaceTypes, vendors } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import type { db as Db } from '@/db'

/**
 * Every indoor maker's inventory, as two tabs on the team's own sheet.
 *
 * Drew, 2 November: "have we wired up a spreadsheet yet? cause we will need
 * that, Elise needs to print inventory out."
 *
 * The register reads these prices off a screen on the day. Everyone else
 * reads them off paper: Elise checking a table in against what the maker
 * said she was bringing, somebody pricing a shelf, somebody answering "what
 * is this and whose is it" at the counter. None of that is a database
 * question and none of those people are going to open the admin.
 *
 * Two tabs, because they answer different questions. INVENTORY is one row
 * per price and is the thing that gets printed: sort it by maker and it is a
 * price list per table. WHO HAS FILED is one row per maker and is the chase
 * list: how many lines, whether she has finished, when she last touched it.
 *
 * Indoor only. An outdoor maker takes her own money at her own tent and we
 * never see her prices, so a row for her would be a blank nobody can fill.
 */

type DbHandle = typeof Db

export type InventoryRow = {
  code: string
  shop: string
  contact: string
  item: string
  /** Dollars, plain, so the sheet can sum and sort it: "7.00". */
  price: string
  /** "2 for $15 · 3 for $20", or empty. */
  multiBuys: string
  note: string
  /** Whether she has said it is finished, in the roster's own words. */
  listStatus: string
  added: string
}

export type MakerListRow = {
  code: string
  shop: string
  contact: string
  email: string
  lines: string
  cheapest: string
  dearest: string
  listStatus: string
  lastTouched: string
}

/** Dollars from cents, for a spreadsheet: never a float, never a symbol. */
const money = (cents: number): string =>
  `${Math.trunc(cents / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`

/** The multi-buys on one line, in the words a person at a counter reads. */
export const multiBuyWords = (breaks: { qty: number; cents: number }[]): string =>
  breaks
    .slice()
    .sort((a, b) => a.qty - b.qty)
    .map((b) => `${b.qty} for $${money(b.cents)}`)
    .join(' · ')

/**
 * Filed, started, or nothing.
 *
 * Three states and not two, because "started" is the one that matters to
 * whoever is chasing: a maker with eleven lines who has not pressed the
 * button needs a reminder, and a maker with none needs a phone call.
 */
export function listState(lines: number, submittedAt: string | null): string {
  if (submittedAt) return 'Filed'
  if (lines > 0) return 'Started'
  return 'Nothing yet'
}

export async function inventoryExport(
  db: DbHandle, showId: string,
): Promise<{ items: InventoryRow[]; makers: MakerListRow[] }> {
  const rows = await db
    .select({ booking: bookings, vendor: vendors, space: spaceTypes })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))
    .orderBy(asc(bookings.vendorCode))

  /* Indoor, and still holding their space. A released booking's prices are
     not going on a shelf, and printing them would put a table on the floor
     plan that nobody is standing at. */
  const live = rows.filter((r) => r.space.track !== 'outdoor' && holdsSpace(r.booking.status))
  if (live.length === 0) return { items: [], makers: [] }

  /* Two queries for every maker's whole list, not two per maker. */
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(
      inArray(inventoryItems.bookingId, live.map((r) => r.booking.id)),
      isNull(inventoryItems.voidedAt),
    ))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))

  const breaks = items.length
    ? await db
        .select()
        .from(inventoryBreaks)
        .where(inArray(inventoryBreaks.itemId, items.map((i) => i.id)))
        .orderBy(asc(inventoryBreaks.qty))
    : []

  const breaksOf = new Map<string, { qty: number; cents: number }[]>()
  for (const b of breaks) {
    breaksOf.set(b.itemId, [...(breaksOf.get(b.itemId) ?? []), { qty: b.qty, cents: b.priceCents }])
  }
  const itemsOf = new Map<string, typeof items>()
  for (const i of items) itemsOf.set(i.bookingId, [...(itemsOf.get(i.bookingId) ?? []), i])

  const out: InventoryRow[] = []
  const makers: MakerListRow[] = []

  for (const r of live) {
    const mine = itemsOf.get(r.booking.id) ?? []
    const state = listState(mine.length, r.booking.inventorySubmittedAt)

    for (const i of mine) {
      out.push({
        code: r.booking.vendorCode,
        shop: r.vendor.shopName,
        contact: r.vendor.contactName,
        item: i.label,
        price: money(i.priceCents),
        multiBuys: multiBuyWords(breaksOf.get(i.id) ?? []),
        note: i.note ?? '',
        listStatus: state,
        added: i.createdAt ? fmtDateTime(i.createdAt) : '',
      })
    }

    /* Every indoor maker gets a row here even with nothing filed, because
       this tab exists to show who has not. */
    const prices = mine.map((i) => i.priceCents)
    const touched = mine
      .map((i) => i.updatedAt ?? i.createdAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1)
    makers.push({
      code: r.booking.vendorCode,
      shop: r.vendor.shopName,
      contact: r.vendor.contactName,
      email: r.vendor.email,
      lines: String(mine.length),
      cheapest: prices.length ? money(Math.min(...prices)) : '',
      dearest: prices.length ? money(Math.max(...prices)) : '',
      listStatus: state,
      lastTouched: touched ? fmtDateTime(touched) : '',
    })
  }

  return { items: out, makers }
}

/* The printed one. Maker first on every row, because a printout gets cut up
   and a loose page has to say whose table it belongs to. */
export const INVENTORY_COLUMNS = [
  'Mermade ID', 'Shop', 'Maker', 'Item', 'Price', 'Multi-buys', 'Note', 'List', 'Added',
] as const

export const inventoryValues = (r: InventoryRow) =>
  [r.code, r.shop, r.contact, r.item, r.price, r.multiBuys, r.note, r.listStatus, r.added]

/* The chase one. */
export const MAKER_LIST_COLUMNS = [
  'Mermade ID', 'Shop', 'Maker', 'Email', 'Lines', 'Cheapest', 'Dearest', 'List', 'Last touched',
] as const

export const makerListValues = (r: MakerListRow) =>
  [r.code, r.shop, r.contact, r.email, r.lines, r.cheapest, r.dearest, r.listStatus, r.lastTouched]
