import { and, asc, eq, isNull } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { inventoryItems } from '@/db/schema'

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
export async function inventoryFor(db: DbHandle, bookingId: string) {
  return db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))
}

/** How many lines a booking has, for the checklist and the roster. */
export async function inventoryCount(db: DbHandle, bookingId: string): Promise<number> {
  return (await inventoryFor(db, bookingId)).length
}
