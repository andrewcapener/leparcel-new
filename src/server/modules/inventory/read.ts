import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { inventoryBreaks, inventoryItems } from '@/db/schema'

type DbHandle = typeof Db

/**
 * A booking's live item list, in the order the maker put it in.
 *
 * Deliberately NOT in account/inventory-actions.ts, which carries the
 * 'use server' directive. Next compiles every export of such a file into a
 * callable endpoint, so a reader living there is a public RPC that takes a
 * booking id and returns that booking's prices. Anybody holding the action id
 * could have read any maker's item list by passing somebody else's id, which
 * is both a leak and a thing no reader should ever be.
 *
 * It also meant a Server Component was calling an action during render, which
 * is the shape use-server-exports.test.ts was written about: the page renders,
 * the button is there, and the failure only appears when somebody presses it.
 */
export type ItemRow = typeof inventoryItems.$inferSelect & {
  /** The product's other variants, fewest first. */
  breaks: { qty: number; cents: number }[]
}

export async function inventoryFor(db: DbHandle, bookingId: string): Promise<ItemRow[]> {
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))
  if (items.length === 0) return []

  /* One query for every line's multi-buys, not one per line. A maker with
     forty lines is forty round trips done the other way, on a page she is
     waiting for. */
  const rows = await db
    .select()
    .from(inventoryBreaks)
    .where(inArray(inventoryBreaks.itemId, items.map((i) => i.id)))
    .orderBy(asc(inventoryBreaks.qty))

  const byItem = new Map<string, { qty: number; cents: number }[]>()
  for (const r of rows) {
    byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), { qty: r.qty, cents: r.priceCents }])
  }
  return items.map((i) => ({ ...i, breaks: byItem.get(i.id) ?? [] }))
}

/** How many lines a booking has, for the checklist and the roster. Counts
 *  products, not variants: a line with three multi-buys is still one line. */
export async function inventoryCount(db: DbHandle, bookingId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
  return Number(row?.n ?? 0)
}
