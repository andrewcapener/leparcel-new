import { centsFromDecimal, type Sale } from '@/server/modules/sales/read'
import type { StatementInput } from './math'

/**
 * A show's takings, split into one statement input per maker.
 *
 * The register rings a basket, not a maker. One order can carry nine makers'
 * goods, a discount spread across all of them and a refund against one, so
 * turning a day of orders into "what each maker earned" is an attribution
 * problem and it is the part that has to be right. statementTotals does the
 * arithmetic afterwards; this decides what goes into it.
 *
 * Pure. Orders in, inputs out, nothing fetched and nothing written.
 */

/** One product's performance on a statement, in the maker's own words. */
export type SoldLine = {
  sku: string
  label: string
  unitCents: number
  qty: number
  grossCents: number
  discountsCents: number
  refundsCents: number
}

export type MakerSales = {
  code: string
  input: StatementInput
  lines: SoldLine[]
  /** Orders this maker appeared in. Not the show's order count. */
  orders: number
  firstAt: string
  lastAt: string
}

/**
 * What a line was discounted by.
 *
 * `discount_allocations` is the authoritative one: Shopify has already
 * prorated the basket's discount across the lines, so a five dollar discount
 * puts $1.15 against the sixty eight dollar candle and 34 cents against the
 * five dollar ring, and the allocations always add back up to the order's
 * own total_discounts.
 *
 * `total_discount` is NOT a second, separate markdown. It is the same money
 * said again, and Shopify fills it on some lines and not others for no
 * reason visible from here. Adding the two was this function's first version
 * and it double counted three lines of this show: MM8 lost $8 of net sales
 * and $6.40 of payout, MM42 a dollar it is not paid for anyway. Found by
 * reconciling the line maths against Shopify's own order subtotal, which is
 * the check that should be run against every show before anybody is paid.
 *
 * So: the allocations where there are any, and the line's own figure only
 * when there are none.
 */
export function lineDiscountCents(li: Record<string, unknown>): number {
  const allocs = (li.discount_allocations ?? []) as Array<Record<string, unknown>>
  if (allocs.length > 0) {
    return allocs.reduce((n, a) => n + centsFromDecimal(a.amount as string), 0)
  }
  return centsFromDecimal(li.total_discount as string)
}

/**
 * What was handed back, per maker.
 *
 * A refund belongs to whoever sold the thing, not to the basket: the $28 bowl
 * that came back is Emily's $28, and spreading it across the order would take
 * money off makers who sold nothing that day.
 */
export function refundsByCode(order: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>()
  const refunds = (order.refunds ?? []) as Array<Record<string, unknown>>
  for (const r of refunds) {
    const items = (r.refund_line_items ?? []) as Array<Record<string, unknown>>
    for (const rli of items) {
      const li = (rli.line_item ?? {}) as Record<string, unknown>
      const code = String(li.vendor ?? '').toUpperCase()
      if (!code) continue
      /* `subtotal` is the goods, before tax, which is what a statement is
         written in. The transaction total includes tax Mermade collected and
         remits, and is never the maker's money. */
      const cents = centsFromDecimal(rli.subtotal as string)
      out.set(code, (out.get(code) ?? 0) + cents)
    }
  }
  return out
}

/**
 * Group a show's orders into per maker statement inputs.
 *
 * `bpsOf` is each booking's own snapshot. A code with no booking falls back
 * to the show rate rather than being dropped, because a sale that exists and
 * is attributed to nobody is worse than one priced at the wrong rate: the
 * first disappears, the second is visible and arguable.
 */
export function makerSales(
  orders: Array<Record<string, unknown>>,
  opts: { bpsOf: Map<string, number>; fallbackBps: number; labelOf: Map<string, string>;
    houseCodes?: Set<string> },
): MakerSales[] {
  const gross = new Map<string, number>()
  const discounts = new Map<string, number>()
  const refunds = new Map<string, number>()
  const items = new Map<string, number>()
  const seenOrders = new Map<string, Set<number>>()
  const first = new Map<string, string>()
  const last = new Map<string, string>()
  const perLine = new Map<string, Map<string, SoldLine>>()

  const bump = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n)

  for (const o of orders) {
    const at = String(o.created_at ?? '')
    const id = Number(o.id)
    const refundShare = refundsByCode(o)

    for (const raw of (o.line_items ?? []) as Array<Record<string, unknown>>) {
      const code = String(raw.vendor ?? '').toUpperCase()
      if (!code) continue
      const qty = Number(raw.quantity ?? 1)
      const unit = centsFromDecimal(raw.price as string)
      const g = unit * qty
      const d = lineDiscountCents(raw)

      bump(gross, code, g)
      bump(discounts, code, d)
      bump(items, code, qty)
      seenOrders.set(code, (seenOrders.get(code) ?? new Set()).add(id))
      if (!first.has(code) || at < first.get(code)!) first.set(code, at)
      if (!last.has(code) || at > last.get(code)!) last.set(code, at)

      const sku = String(raw.sku ?? '')
      const byline = perLine.get(code) ?? new Map<string, SoldLine>()
      const row = byline.get(sku) ?? {
        sku,
        label: opts.labelOf.get(sku) ?? '',
        unitCents: unit,
        qty: 0,
        grossCents: 0,
        discountsCents: 0,
        refundsCents: 0,
      }
      row.qty += qty
      row.grossCents += g
      row.discountsCents += d
      byline.set(sku, row)
      perLine.set(code, byline)
    }

    refundShare.forEach((cents, code) => bump(refunds, code, cents))
  }

  const codes = [...new Set([...gross.keys(), ...refunds.keys()])]
  return codes.map((code) => {
    const house = opts.houseCodes?.has(code) ?? false
    return {
      code,
      orders: seenOrders.get(code)?.size ?? 0,
      firstAt: first.get(code) ?? '',
      lastAt: last.get(code) ?? '',
      lines: [...(perLine.get(code)?.values() ?? [])]
        .sort((a, b) => b.grossCents - a.grossCents || a.sku.localeCompare(b.sku)),
      input: {
        grossCents: gross.get(code) ?? 0,
        discountsCents: discounts.get(code) ?? 0,
        refundsCents: refunds.get(code) ?? 0,
        /* The market's own stock has nobody to pay, so no commission is
           taken off it and no statement is ever sent for it. */
        commissionBps: house ? 0 : opts.bpsOf.get(code) ?? opts.fallbackBps,
        adjustments: [],
        itemsSold: items.get(code) ?? 0,
      },
    }
  }).sort((a, b) => b.input.grossCents - a.input.grossCents)
}
