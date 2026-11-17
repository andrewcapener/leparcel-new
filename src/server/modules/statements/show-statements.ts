import { eq } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { bookings, vendors } from '@/db/schema'
import { usd } from '@/lib/money'
import { HOUSE_CODES } from '@/server/modules/sales/read'
import { fetchSales } from '@/server/modules/sales/fetch'
import { makerSales, type SoldLine } from './from-sales'
import { statementTotals, type StatementTotals } from './math'

type DbHandle = typeof Db

/**
 * Every maker's statement for a show, ready to be read by a person.
 *
 * Drew: "it's time to work on sales reports for each vendor." Elise has been
 * reading a register report and typing them, one maker at a time.
 *
 * Nothing here sends anything and nothing here pays anybody. It assembles
 * what is true and hands it to a screen, because the one instruction that
 * came with this was that none of it goes out until it has been read.
 */

export type MakerStatement = {
  code: string
  shop: string
  contact: string
  email: string
  totals: StatementTotals
  lines: SoldLine[]
  orders: number
}

/**
 * What to call a line nobody named.
 *
 * Several makers sent prices by text during the show with no product name,
 * so the register carries "$28" and nothing else. Printing an empty cell on
 * a statement reads as a mistake; printing the price reads as what it is,
 * which is all anybody knows about it. Drew, asked directly: "not named
 * items can simply be titled the price."
 */
export function lineLabel(l: SoldLine): string {
  return l.label.trim() || usd(l.unitCents)
}

/**
 * The one line of the email that sounds like a person wrote it.
 *
 * Her best selling product, by money rather than by count, so a maker who
 * shifted forty one dollar stickers is not told that was the story of her
 * weekend when a single piece earned her more. Null when there is nothing
 * worth singling out.
 */
export function bestSeller(lines: SoldLine[]): SoldLine | null {
  const live = lines.filter((l) => l.qty > 0)
  if (live.length < 2) return null
  const top = [...live].sort((a, b) => b.grossCents - a.grossCents)[0]
  return top.qty > 1 ? top : null
}

export type StatementSet =
  | { ok: true; makers: MakerStatement[]; at: string }
  | { ok: false; detail: string }

export async function showStatements(db: DbHandle, showId: string): Promise<StatementSet> {
  const read = await fetchSales()
  if (!read.ok) return { ok: false, detail: read.detail }

  const roster = await db
    .select({
      code: bookings.vendorCode,
      bps: bookings.commissionBps,
      shop: vendors.shopName,
      contact: vendors.contactName,
      email: vendors.email,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.showId, showId))

  const bpsOf = new Map(roster.map((r) => [r.code.toUpperCase(), r.bps]))
  const who = new Map(roster.map((r) => [r.code.toUpperCase(), r]))

  /* The raw orders again rather than the reduced Sale rows: the attribution
     needs discount_allocations and the refund lines, which a summary throws
     away. */
  const makers = makerSales(read.orders, {
    bpsOf,
    fallbackBps: 2000,
    labelOf: read.labels,
    houseCodes: HOUSE_CODES,
  })

  return {
    ok: true,
    at: read.at,
    makers: makers
      /* The market's own stock has nobody to pay and nobody to write to, so
         it never becomes a statement. Drew: "MM42 does not need one." */
      .filter((m) => !HOUSE_CODES.has(m.code))
      .map((m) => {
        const r = who.get(m.code)
        return {
          code: m.code,
          shop: r?.shop ?? '',
          contact: r?.contact ?? '',
          email: r?.email ?? '',
          totals: statementTotals(m.input),
          lines: m.lines,
          orders: m.orders,
        }
      }),
  }
}
