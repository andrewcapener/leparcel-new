'use server'

import { randomUUID } from 'crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, inventoryItems, vendors } from '@/db/schema'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'
import { listState, readLine } from '@/server/modules/inventory/lines'

/**
 * The maker's own item list, edited by the maker.
 *
 * Every action here re-establishes who is asking from the session cookie and
 * finds their booking itself. Nothing is taken from the form except the
 * values being saved, so a posted booking id or vendor id cannot reach
 * another maker's list. The row id is checked against their own booking
 * before anything is written.
 *
 * Open until the Show's inventory date, shut after it. Staff are never shut
 * out; that lives on the admin side, because the answer to somebody turning
 * up on the Thursday with one more thing is a person deciding.
 *
 * 'use server' files may only export async functions, which is why the
 * shared lookup below is a plain local and not an export.
 */

type Who = { bookingId: string; open: boolean }

async function whoIsAsking(): Promise<Who | null> {
  const email = await readSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) return null
  const show = await activeShow()
  if (!show) return null
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) return null
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.showId, show.id), eq(bookings.vendorId, vendor.id)))
    .limit(1)
  if (!booking) return null
  return {
    bookingId: booking.id,
    open: listState(show.inventoryDueAt, new Date().toISOString()) !== 'locked',
  }
}

/** Back to the list, with a sentence when something was wrong. */
function back(why?: string, echo?: Record<string, string>): never {
  const q = new URLSearchParams()
  if (why) q.set('inv', why)
  for (const [k, v] of Object.entries(echo ?? {})) if (v) q.set(k, v)
  const s = q.toString()
  redirect(`/account${s ? `?${s}` : '?inv=saved'}#items`)
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? '')

export async function addInventoryItem(fd: FormData): Promise<void> {
  const who = await whoIsAsking()
  if (!who) redirect('/account')
  if (!who.open) back('shut')

  const typed = {
    label: field(fd, 'label'),
    price: field(fd, 'price'),
    bundleQty: field(fd, 'bundleQty'),
    bundlePrice: field(fd, 'bundlePrice'),
  }
  const read = readLine(typed)
  /* Values come back with the complaint, the way /apply does it. Retyping
     four fields because one of them had a dollar sign in the wrong place is
     how a form teaches somebody to give up on it. */
  if ('bad' in read) {
    back(read.bad, {
      l: typed.label, p: typed.price, bq: typed.bundleQty, bp: typed.bundlePrice,
    })
  }

  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, who.bookingId), isNull(inventoryItems.voidedAt)))

  await db.insert(inventoryItems).values({
    id: randomUUID(),
    bookingId: who.bookingId,
    label: read.line.label,
    priceCents: read.line.priceCents,
    bundleQty: read.line.bundleQty,
    bundleCents: read.line.bundleCents,
    note: field(fd, 'note').trim() || null,
    sortOrder: Number(n) + 1,
    createdBy: 'maker',
  })

  revalidatePath('/account')
  back()
}

export async function saveInventoryItem(fd: FormData): Promise<void> {
  const who = await whoIsAsking()
  if (!who) redirect('/account')
  if (!who.open) back('shut')

  const id = field(fd, 'id')
  /* Their own booking, and not voided. A row id from somebody else's list
     matches nothing and writes nothing. */
  const [row] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.id, id),
      eq(inventoryItems.bookingId, who.bookingId),
      isNull(inventoryItems.voidedAt),
    ))
    .limit(1)
  if (!row) back('That line is no longer on your list.')

  const read = readLine({
    label: field(fd, 'label'),
    price: field(fd, 'price'),
    bundleQty: field(fd, 'bundleQty'),
    bundlePrice: field(fd, 'bundlePrice'),
  })
  if ('bad' in read) back(read.bad, { row: id })

  await db.update(inventoryItems).set({
    label: read.line.label,
    priceCents: read.line.priceCents,
    bundleQty: read.line.bundleQty,
    bundleCents: read.line.bundleCents,
    note: field(fd, 'note').trim() || null,
    updatedAt: new Date().toISOString(),
  }).where(eq(inventoryItems.id, row.id))

  revalidatePath('/account')
  back()
}

export async function removeInventoryItem(fd: FormData): Promise<void> {
  const who = await whoIsAsking()
  if (!who) redirect('/account')
  if (!who.open) back('shut')

  /* Voided, never deleted (rule 3), so the list can be read back as it stood
     on the day it locked. A maker who removes the wrong line can be given it
     back by staff rather than being asked what it said. */
  await db.update(inventoryItems).set({
    voidedAt: new Date().toISOString(),
    voidedBy: 'maker',
    voidReason: 'removed by the maker',
  }).where(and(
    eq(inventoryItems.id, field(fd, 'id')),
    eq(inventoryItems.bookingId, who.bookingId),
    isNull(inventoryItems.voidedAt),
  ))

  revalidatePath('/account')
  back('removed')
}

/** The live list, newest ordering, for the page to render. */
export async function inventoryFor(bookingId: string) {
  return db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))
}
