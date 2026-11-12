import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { auditLog, inventoryItems } from '@/db/schema'

type DbHandle = typeof Db

/**
 * Change one price while the show is open.
 *
 * Drew, the night before doors: "vendors will come in and want to change
 * things, or we'll find a discrepancy here and there, and I won't have my
 * laptop."
 *
 * Everything else about inventory assumes a quiet week in October. This
 * assumes a queue at the register and a maker standing at the counter saying
 * the five dollar one is six. So it does one thing, it does it in the
 * database first and the register second, and it writes down who said so.
 *
 * The database first, and not Shopify first, for a reason that only shows up
 * in December: the payout is computed from what Mermade says a maker's goods
 * cost, and an edit made only at the register is a sale nobody can reconcile
 * against a price list. Changing it here and pushing means the two agree.
 */

/** A price edit that has not happened yet, so it can be checked and shown. */
export type PriceEdit = {
  itemId: string
  label: string
  fromCents: number
  toCents: number
}

/**
 * Which of the submitted prices are actually changes.
 *
 * Pure, so the screen can say "two changes" before anything is written and
 * say the same thing afterwards. A field somebody tabbed through and left
 * alone is not an edit and must not be audit-logged as one.
 */
export function pendingEdits(
  lines: Array<{ id: string; label: string; priceCents: number }>,
  submitted: Map<string, number>,
): PriceEdit[] {
  const out: PriceEdit[] = []
  for (const l of lines) {
    const to = submitted.get(l.id)
    if (to === undefined || to === l.priceCents) continue
    out.push({ itemId: l.id, label: l.label, fromCents: l.priceCents, toCents: to })
  }
  return out
}

/**
 * A price has to be a price.
 *
 * Nothing free and nothing negative, because both are a typo rather than an
 * intention and both reach a till. The ceiling is deliberately generous and
 * exists only to catch a missing decimal point: somebody typing 4500 meaning
 * $45 should be stopped at the counter, not discovered in a statement.
 */
export const MAX_PRICE_CENTS = 500_00

export function priceProblem(cents: number): string | null {
  if (!Number.isInteger(cents)) return 'a price has to be whole cents'
  if (cents <= 0) return 'a price has to be more than nothing'
  if (cents > MAX_PRICE_CENTS) return 'that is over $500, so check it before sending'
  return null
}

/**
 * Apply the edits, each one audit-logged with what it was.
 *
 * Rule 3: a financial record is never quietly overwritten. The row changes,
 * because the register has to read one price and not a history, but the old
 * price survives in the log with the name of whoever changed it, which is
 * what a dispute in December is actually asking for.
 */
export async function applyPriceEdits(
  db: DbHandle, edits: PriceEdit[], actor: string, reason: string,
): Promise<number> {
  let done = 0
  for (const e of edits) {
    const bad = priceProblem(e.toCents)
    if (bad) continue

    /* Still live, and still at the price the screen was showing. Somebody
       else may have changed it in the minute this form was open, and the
       quiet overwrite of their edit is the bug nobody finds. */
    const [row] = await db
      .select({ id: inventoryItems.id, priceCents: inventoryItems.priceCents })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, e.itemId), isNull(inventoryItems.voidedAt)))
      .limit(1)
    if (!row || row.priceCents !== e.fromCents) continue

    await db
      .update(inventoryItems)
      .set({ priceCents: e.toCents, updatedAt: new Date().toISOString() })
      .where(eq(inventoryItems.id, e.itemId))

    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'inventory_item',
      entityId: e.itemId,
      action: 'price_changed',
      actor,
      before: JSON.stringify({ label: e.label, priceCents: e.fromCents }),
      after: JSON.stringify({ label: e.label, priceCents: e.toCents }),
      reason,
    })
    done += 1
  }
  return done
}
