import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import {
  applications, bookings, inventoryBreaks, inventoryItems, spaceTypes, vendors,
} from '@/db/schema'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { usd } from '@/lib/money'
import type { db as Db } from '@/db'

/**
 * Every indoor maker's price list, in the shape Shopify's register reads.
 *
 * The show runs on Shopify POS. A hundred makers' goods sell through one
 * counter, Mermade keeps its percentage, and afterwards each maker is paid
 * what hers sold for. All of that hangs on one thing being right at the
 * moment a product is created: the Mermade ID has to be on it.
 *
 * Three fields carry it, and they do different jobs:
 *
 *   VENDOR is the Mermade ID alone, "MM28". It is what the payout is grouped
 *   by, and it is also the only thing a Shopify smart collection can be ruled
 *   on. Collection rules can match title, type, tag and vendor but NOT sku,
 *   so the per-maker collections on the register exist because of this field
 *   and would not work without it. Last season put the shop name here and the
 *   MM number only in the title, which is why last season's collections are
 *   empty now.
 *
 *   SKU is "MM28-7": the maker, then which of her lines. It is what somebody
 *   types at the register to find a price in two seconds, and it is what the
 *   push matches on, so a maker who corrects a price on Thursday updates that
 *   line instead of creating a second one.
 *
 *   TITLE is "(MM28) Leather keyring", or "(MM28) $24" for the many makers who
 *   sent prices with no names. The code comes first because that is the
 *   convention the register staff already know from last season, and because
 *   a screen of forty titles that all begin "$24" is unreadable.
 *
 * Indoor only. An outdoor maker takes her own money at her own tent, so a
 * product of hers in this register would be a sale Mermade has to account for
 * and has no right to.
 */

export type PushLine = {
  label: string
  priceCents: number
  breaks: { qty: number; cents: number }[]
}

export type MakerLines = {
  code: string
  shop: string
  category: string
  lines: PushLine[]
}

/** One way to buy a line: singly, or in whatever bundle the maker offers. */
export type PushVariant = {
  sku: string
  /** The option value shown at the till. "1", "2", "3". */
  qty: string
  /** What the customer pays for THAT many. Not a unit price. */
  priceCents: number
}

/** One product the push route creates, with a variant per way to buy it. */
export type PushProduct = {
  title: string
  vendor: string
  productType: string
  tags: string[]
  /** Always at least one, and the first is always the single. */
  variants: PushVariant[]
}

/** "MM28-7". Not padded, because last season's are not and the register has
 *  four years of muscle memory for the short form. */
export function skuFor(code: string, n: number): string {
  return `${code.toUpperCase()}-${n}`
}

/**
 * "(MM28) Leather keyring", or "(MM28) $24" when the maker sent a bare price.
 *
 * Drew, on the makers who sent nothing but numbers: "we actually don't need a
 * title, we can just go off of their prices." True at the till, where the
 * price is what is being rung up. Not true on a screen listing forty of them,
 * where every row would read the same. The code is what tells them apart.
 */
export function titleFor(code: string, label: string, priceCents: number): string {
  const name = (label ?? '').trim()
  return `(${code.toUpperCase()}) ${name || usd(priceCents)}`
}

/**
 * The whole payload: one product per price line, one variant per way to buy it.
 *
 * Drew, on the multi-buys: "essentially you click in on an item and it says
 * one for 10 and three for 15. That should be a variant in Shopify." He is
 * right, and it is the difference between a register that charges correctly
 * and a cashier doing arithmetic off a printed sheet at the counter with a
 * queue behind them.
 *
 * The bundle price is the price of the BUNDLE, not of one item in it. A
 * variant called 2 at $296 is rung up once and takes $296, which is what the
 * maker promised and what the customer expects. It does mean the unit count
 * on a report is short: two belts leave the building recorded as one sale of
 * the two-belt variant. The money is right, which is what the payout is made
 * of, and Mermade does not track stock on consignment anyway.
 *
 * The singles variant is always first and always present, because a maker who
 * offers three for $15 still sells one to somebody who only wants one.
 */
export function shopifyProducts(makers: MakerLines[]): PushProduct[] {
  const out: PushProduct[] = []
  for (const m of makers) {
    const code = m.code.toUpperCase()
    m.lines.forEach((line, i) => {
      const base = skuFor(code, i + 1)
      const variants: PushVariant[] = [{ sku: base, qty: '1', priceCents: line.priceCents }]
      /* Cheapest bundle first, which is the order a person reads them in and
         the order they will be stacked in on the till. */
      for (const b of [...line.breaks].sort((a, z) => a.qty - z.qty)) {
        /* A bundle of one, or one that costs the same as buying singly, is
           not an offer: it is a second button that does nothing, and on a
           register every extra button is a chance to press the wrong one. */
        if (b.qty < 2 || b.cents >= line.priceCents * b.qty) continue
        variants.push({ sku: `${base}x${b.qty}`, qty: String(b.qty), priceCents: b.cents })
      }
      out.push({
        title: titleFor(code, line.label, line.priceCents),
        /* The ID alone. A vendor of "MM28 Spurs & Saddles" would not match a
           collection ruled on "MM28", and the rule has to be exact. */
        vendor: code,
        productType: m.category || 'Other',
        /* The code again as a tag, so a maker's whole table can be found by
           typing it even if somebody later edits the vendor field. */
        tags: [code, m.category || 'Other'].filter(Boolean),
        variants,
      })
    })
  }
  return out
}

/** One collection per maker who actually has something to sell. */
export function collectionsFor(makers: MakerLines[]): Array<{ code: string; shop: string }> {
  return makers
    .filter((m) => m.lines.length > 0)
    .map((m) => ({ code: m.code.toUpperCase(), shop: m.shop }))
}

/**
 * The multi-buys, which Shopify cannot carry.
 *
 * "Buy 2 for $296" is not a product and not a price; it is a rule about a
 * basket, and a plain catalogue has nowhere to put it. Rather than drop them
 * silently, which would have the register charging Valentina's customers
 * twice what she promised, they come out as a list somebody prints and keeps
 * by the till.
 */
export function multiBuySheet(makers: MakerLines[]): Array<{
  code: string; shop: string; sku: string; item: string; offer: string
}> {
  const out: Array<{ code: string; shop: string; sku: string; item: string; offer: string }> = []
  for (const m of makers) {
    m.lines.forEach((line, i) => {
      if (line.breaks.length === 0) return
      out.push({
        code: m.code.toUpperCase(),
        shop: m.shop,
        sku: skuFor(m.code, i + 1),
        item: line.label?.trim() || usd(line.priceCents),
        offer: line.breaks
          .slice()
          .sort((a, b) => a.qty - b.qty)
          .map((b) => `${b.qty} for ${usd(b.cents)}`)
          .join(' · '),
      })
    })
  }
  return out
}

type DbHandle = typeof Db

/** Every indoor maker holding a space at this show, with her lines. */
export async function makerLines(db: DbHandle, showId: string): Promise<MakerLines[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      code: bookings.vendorCode,
      shop: vendors.shopName,
      category: applications.category,
      track: spaceTypes.track,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .leftJoin(applications, eq(bookings.applicationId, applications.id))
    .where(eq(bookings.showId, showId))
    .orderBy(asc(bookings.vendorCode))

  const live = rows.filter((r) => r.track !== 'outdoor' && holdsSpace(r.status))
  if (live.length === 0) return []

  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(
      inArray(inventoryItems.bookingId, live.map((r) => r.bookingId)),
      isNull(inventoryItems.voidedAt),
    ))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))

  const breaks = items.length
    ? await db.select().from(inventoryBreaks)
        .where(inArray(inventoryBreaks.itemId, items.map((i) => i.id)))
        .orderBy(asc(inventoryBreaks.qty))
    : []

  const breaksOf = new Map<string, { qty: number; cents: number }[]>()
  for (const b of breaks) {
    breaksOf.set(b.itemId, [...(breaksOf.get(b.itemId) ?? []), { qty: b.qty, cents: b.priceCents }])
  }
  const linesOf = new Map<string, PushLine[]>()
  for (const i of items) {
    linesOf.set(i.bookingId, [...(linesOf.get(i.bookingId) ?? []), {
      label: i.label ?? '',
      priceCents: i.priceCents,
      breaks: breaksOf.get(i.id) ?? [],
    }])
  }

  return live.map((r) => ({
    code: r.code,
    shop: r.shop,
    category: r.category ?? 'Other',
    lines: linesOf.get(r.bookingId) ?? [],
  }))
}
