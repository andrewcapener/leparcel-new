'use server'

import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { auditLog, inventoryBreaks, inventoryItems } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { applyPriceEdits, pendingEdits, priceProblem } from '@/server/modules/inventory/edit'
import { priceFromDollars, readPastedList } from '@/server/modules/inventory/lines'
import { makerLines, shopifyProducts } from '@/server/modules/shopify/products'

/**
 * Change a price at the show and have the register know, in one press.
 *
 * Two screens existed for this already: the roster, where somebody could
 * paste a maker's list, and /admin/shopify, where somebody could send
 * everything to Shopify. On a laptop in October that is fine. At a counter on
 * a Saturday it is two screens, four taps and a decision about whether the
 * second one is safe to press, which is three too many.
 */

async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

export type SaveState = {
  error: string | null
  /** What happened, in the words the screen shows back. */
  note: string | null
  changed: number
}

const wiring = () => {
  const url = process.env.SHOPIFY_API_URL?.replace(/\/$/, '')
  const key = process.env.SHOPIFY_EXECUTE_KEY
  return url && key ? { url, key } : null
}

/**
 * Send every indoor maker's prices to Shopify.
 *
 * Everybody and not just the maker who changed, because the push matches on
 * SKU and rewrites only what differs: sending one maker and sending all of
 * them produce the same store, and sending all of them cannot leave a second
 * edit behind that somebody made while this screen was open.
 */
async function pushToRegister(): Promise<{ ok: boolean; detail: string }> {
  const w = wiring()
  if (!w) return { ok: false, detail: 'the register link is not configured on this app' }

  const show = await activeShow()
  if (!show) return { ok: false, detail: 'no active show' }

  const products = shopifyProducts(await makerLines(db, show.id))
  if (products.length === 0) return { ok: false, detail: 'there are no prices to send' }

  try {
    const res = await fetch(`${w.url}/shopify-products-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': w.key },
      body: JSON.stringify({ client: 'mermade', dryRun: false, products }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) return { ok: false, detail: String(data?.error ?? 'Shopify refused it') }
    const c = data?.counts ?? {}
    return { ok: true, detail: `${c.update ?? 0} updated, ${c.create ?? 0} added` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'could not reach the register' }
  }
}

/**
 * Save the prices on one maker, then send.
 *
 * The send happens even when nothing changed, because the other reason
 * somebody is on this screen is that the register is showing something stale
 * and they want it pushed again.
 */
export async function savePrices(prev: SaveState, fd: FormData): Promise<SaveState> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim() || 'changed at the show'
  if (!bookingId) return { ...prev, error: 'No maker.', note: null }

  const lines = await db
    .select({ id: inventoryItems.id, label: inventoryItems.label, priceCents: inventoryItems.priceCents })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))

  /* Read as dollars the way every other price box in this app does, so "6",
     "6.00" and "$6" all mean the same thing and 4.10 is 410 and not 409. */
  const submitted = new Map<string, number>()
  for (const l of lines) {
    const raw = String(fd.get(`price:${l.id}`) ?? '').trim()
    if (!raw) continue
    const read = priceFromDollars(raw)
    if ('bad' in read) return { ...prev, error: `${l.label || 'That line'}: ${read.bad}`, note: null }
    const bad = priceProblem(read.cents)
    if (bad) return { ...prev, error: `${l.label || 'That line'}: ${bad}`, note: null }
    submitted.set(l.id, read.cents)
  }

  const edits = pendingEdits(lines, submitted)
  const changed = edits.length
    ? await applyPriceEdits(db, edits, await staffActor(), reason)
    : 0

  const push = await pushToRegister()
  revalidatePath('/admin/register')

  if (!push.ok) {
    return {
      error: `Saved here, but the register did not take it: ${push.detail}`,
      note: null,
      changed,
    }
  }
  return {
    error: null,
    note: changed === 0
      ? `Nothing to change, and the register was sent again anyway. ${push.detail}.`
      : `${changed === 1 ? 'One price' : `${changed} prices`} changed and sent. ${push.detail}.`,
    changed,
  }
}

/**
 * Add what a maker turns up with, and send it.
 *
 * The same parser her own box uses and the same one the roster pastes into,
 * so "Earrings $18, 2 for $30" works here exactly as it works there. Appended
 * to the end of her list, never inserted, because the SKUs the push builds
 * are positional and inserting a line in the middle renumbers every line
 * under it.
 */
export async function addLines(prev: SaveState, fd: FormData): Promise<SaveState> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const raw = String(fd.get('list') ?? '')
  if (!bookingId) return { ...prev, error: 'No maker.', note: null }

  const read = readPastedList(raw)
  if (read.lines.length === 0) {
    return { ...prev, error: 'Nothing read from that. One line each, like "Earrings $18".', note: null }
  }
  for (const line of read.lines) {
    const bad = priceProblem(line.priceCents)
    if (bad) return { ...prev, error: `${line.label || 'That line'}: ${bad}`, note: null }
  }

  const actor = await staffActor()

  /* After whatever she already has, counted off the live rows so a second
     press adds a second time rather than quietly overwriting. */
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))

  const made = read.lines.map((line, i) => ({
    row: {
      id: randomUUID(),
      bookingId,
      label: line.label,
      priceCents: line.priceCents,
      sortOrder: Number(n) + 1 + i,
      /* Not 'maker'. She did not type this, and the record should not say she
         did, which matters the first time a price is disputed. */
      createdBy: actor,
    },
    breaks: line.breaks,
  }))

  await db.insert(inventoryItems).values(made.map((m) => m.row))
  for (const m of made) {
    if (m.breaks.length === 0) continue
    await db.insert(inventoryBreaks).values(m.breaks.map((b, i) => ({
      id: randomUUID(),
      itemId: m.row.id,
      qty: b.qty,
      priceCents: b.cents,
      sortOrder: i,
    })))
  }

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'inventory_added_at_show',
    actor,
    before: null,
    after: JSON.stringify({ lines: made.length }),
    reason: 'added at the show',
  })

  const push = await pushToRegister()
  revalidatePath('/admin/register')

  if (!push.ok) {
    return {
      error: `Added here, but the register did not take it: ${push.detail}`,
      note: null,
      changed: made.length,
    }
  }
  return {
    error: null,
    note: `${made.length === 1 ? 'One line' : `${made.length} lines`} added and sent. ${push.detail}.`,
    changed: made.length,
  }
}
