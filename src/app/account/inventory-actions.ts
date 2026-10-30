'use server'

import { randomUUID } from 'crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, inventoryBreaks, inventoryItems, vendors } from '@/db/schema'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'
import { MAX_BREAKS, listState, readLine, readPastedList } from '@/server/modules/inventory/lines'
import type { InvCode } from '@/server/modules/inventory/notices'

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

/**
 * Who is asking, or the sentence saying why nothing can be saved.
 *
 * Every one of these used to return null, and every caller turned null into a
 * bare redirect to /account. From the maker's side that is a page that
 * reloads, saves nothing and says nothing, which is indistinguishable from a
 * broken button and is the worst thing a form can do. Whatever the reason, it
 * is now said out loud.
 */
async function whoIsAsking(): Promise<Who | { no: InvCode }> {
  const email = await readSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) return { no: 'expired' }
  const show = await activeShow()
  if (!show) return { no: 'noshow' }
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) return { no: 'nomaker' }
  /* Ordered, and the oldest wins. Two unordered limit(1) queries over the same
     filter, one here and one on the page that renders the list, are not
     promised to pick the same row: a maker who somehow holds two bookings at
     one show could have her lines written against one and read back from the
     other, which looks exactly like saving nothing. */
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.showId, show.id), eq(bookings.vendorId, vendor.id)))
    .orderBy(asc(bookings.createdAt), asc(bookings.id))
    .limit(1)
  if (!booking) return { no: 'nospace' }
  return {
    bookingId: booking.id,
    open: listState(show.inventoryDueAt, new Date().toISOString()) !== 'locked',
  }
}

/**
 * Back to the list, carrying a CODE rather than a sentence.
 *
 * The words live in inventory/notices.ts. What travelled here before was the
 * complaint itself, and the page rendered whatever arrived as an official
 * notice, which made any text at all paintable onto the real domain.
 */
function back(why?: InvCode | 'bad', echo?: Record<string, string>): never {
  const q = new URLSearchParams()
  if (why) q.set('inv', why)
  for (const [k, v] of Object.entries(echo ?? {})) if (v) q.set(k, v)
  const s = q.toString()
  redirect(`/account${s ? `?${s}` : '?inv=saved'}#items`)
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? '')

/**
 * The multi-buy rows, as the form posts them.
 *
 * Three pairs of boxes, named bq0/bp0 through bq2/bp2, all optional. Blank
 * pairs are dropped by readLine; a half filled one is refused there, which
 * is where every other rule about a price already lives.
 */
const breaksFrom = (fd: FormData) =>
  Array.from({ length: MAX_BREAKS }, (_, i) => ({
    qty: field(fd, `bq${i}`),
    price: field(fd, `bp${i}`),
  }))

/** What they typed, echoed back so a refusal never costs a retype. */
const echoBreaks = (typed: { qty: string; price: string }[]) =>
  Object.fromEntries(typed.flatMap((b, i) => [[`bq${i}`, b.qty], [`bp${i}`, b.price]]))

/**
 * Write a line's multi-buys, replacing whatever it had.
 *
 * Deleted and re-inserted rather than reconciled: there are at most three of
 * them, they carry nothing a maker would miss, and a diff against three rows
 * is more code than it saves. The unique index on (item_id, qty) is what
 * stops the same quantity being priced twice.
 */
async function writeBreaks(
  tx: typeof db, itemId: string, breaks: { qty: number; cents: number }[],
): Promise<void> {
  await tx.delete(inventoryBreaks).where(eq(inventoryBreaks.itemId, itemId))
  if (breaks.length === 0) return
  await tx.insert(inventoryBreaks).values(breaks.map((b, i) => ({
    id: randomUUID(),
    itemId,
    qty: b.qty,
    priceCents: b.cents,
    sortOrder: i,
  })))
}

/**
 * Nothing in here may throw.
 *
 * A server action that throws returns an error response, and the browser's
 * answer to that is to do absolutely nothing: no navigation, no message, the
 * typed line simply gone. From the far side of a phone it is identical to a
 * dead button, and it is what Drew hit over and over while every guard I had
 * added sat around the one query that was failing.
 *
 * Half this file's database work was outside its try blocks: the three
 * lookups in whoIsAsking, the max(sort_order) read before an insert, the
 * count before a submit. Any one of them throwing was silent.
 *
 * redirect() also works by throwing, so that one specific error is let
 * through. Everything else becomes a sentence the maker can read and a line
 * in the log with the real reason in it.
 */
function isRedirect(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

async function guard(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run()
  } catch (err) {
    if (isRedirect(err)) throw err
    console.error(`[inventory] ${what}:`, err)
    back('dberr')
  }
}


export async function addInventoryItem(fd: FormData): Promise<void> {
  await guard('add', async () => {
    const who = await whoIsAsking()
    if ('no' in who) back(who.no)
    if (!who.open) back('shut')

    const typed = {
      label: field(fd, 'label'),
      price: field(fd, 'price'),
      breaks: breaksFrom(fd),
    }
    const read = readLine(typed)
    /* Values come back with the complaint, the way /apply does it. Retyping
       four fields because one of them had a dollar sign in the wrong place is
       how a form teaches somebody to give up on it. */
    if ('bad' in read) {
      back('bad', {
        l: typed.label, p: typed.price, ...echoBreaks(typed.breaks),
      })
    }

    const [{ n }] = await db
      .select({ n: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.bookingId, who.bookingId), isNull(inventoryItems.voidedAt)))

    const id = randomUUID()
    try {
      await db.insert(inventoryItems).values({
        id,
        bookingId: who.bookingId,
        label: read.line.label,
        priceCents: read.line.priceCents,
        sortOrder: Number(n) + 1,
        createdBy: 'maker',
      })
      await writeBreaks(db, id, read.line.breaks)
    } catch (err) {
      /* A throw here used to surface as a server action that failed, which the
         browser shows as nothing at all: the maker presses Add, the page sits
         there, and the line is gone. Say it, and keep what they typed. */
      console.error(`[inventory] add for ${who.bookingId}:`, err)
      back('dberr', {
        l: typed.label, p: typed.price, ...echoBreaks(typed.breaks),
      })
    }

    revalidatePath('/account')
    back()
  })
}

/**
 * A whole list, pasted in the shape Elise asks for it.
 *
 * Drew, 29 October: "thats how she usually asks for it." Makers already
 * answer her in that format, so typing the same list again one field at a
 * time is work we invented. Everything readable is added; everything else
 * comes back in the box with the reason beside it.
 */
export async function addPastedList(fd: FormData): Promise<void> {
  await guard('paste', async () => {
    const who = await whoIsAsking()
    if ('no' in who) back(who.no)
    if (!who.open) back('shut')

    const raw = field(fd, 'list')
    const read = readPastedList(raw)
    if (read.lines.length === 0) back('nolines', { list: raw })

    try {
      const [{ n }] = await db
        .select({ n: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)` })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.bookingId, who.bookingId), isNull(inventoryItems.voidedAt)))

      const made = read.lines.map((line, i) => ({
        row: {
          id: randomUUID(),
          bookingId: who.bookingId,
          label: line.label,
          priceCents: line.priceCents,
          sortOrder: Number(n) + 1 + i,
          createdBy: 'maker',
        },
        breaks: line.breaks,
      }))
      await db.insert(inventoryItems).values(made.map((m) => m.row))
      for (const m of made) await writeBreaks(db, m.row.id, m.breaks)
    } catch (err) {
      console.error(`[inventory] paste for ${who.bookingId}:`, err)
      back('dberr', { list: raw })
    }

    revalidatePath('/account')
    /* What could not be read goes back in the box, so the maker fixes two
       lines rather than hunting through forty. */
    if (read.bad.length > 0) {
      back('pasted', { list: read.bad.map((b) => b.raw).join('\n') })
    }
    back()
  })
}

export async function saveInventoryItem(fd: FormData): Promise<void> {
  await guard('save', async () => {
    const who = await whoIsAsking()
    if ('no' in who) back(who.no)
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
    if (!row) back('gone')

    const read = readLine({
      label: field(fd, 'label'),
      price: field(fd, 'price'),
      breaks: breaksFrom(fd),
    })
    /* The typed values come back so an edit refused over one character is not
       retyped from scratch, and the row is named so the complaint is attached
       to the line it is about rather than floating at the top of the card. */
    if ('bad' in read) {
      back('bad', {
        row: id, l: field(fd, 'label'), p: field(fd, 'price'),
        ...echoBreaks(breaksFrom(fd)),
      })
    }

    try {
      await db.update(inventoryItems).set({
        label: read.line.label,
        priceCents: read.line.priceCents,
        updatedAt: new Date().toISOString(),
      }).where(eq(inventoryItems.id, row.id))
      await writeBreaks(db, row.id, read.line.breaks)
    } catch (err) {
      console.error(`[inventory] save ${row.id}:`, err)
      back('dberr')
    }

    revalidatePath('/account')
    back()
  })
}

export async function removeInventoryItem(fd: FormData): Promise<void> {
  await guard('remove', async () => {
    const who = await whoIsAsking()
    if ('no' in who) back(who.no)
    if (!who.open) back('shut')

    /* Voided, never deleted (rule 3), so the list can be read back as it stood
       on the day it locked. A maker who removes the wrong line can be given it
       back by staff rather than being asked what it said. */
    let matched = 0
    try {
      const gone = await db.update(inventoryItems).set({
        voidedAt: new Date().toISOString(),
        voidedBy: 'maker',
        voidReason: 'removed by the maker',
      }).where(and(
        eq(inventoryItems.id, field(fd, 'id')),
        eq(inventoryItems.bookingId, who.bookingId),
        isNull(inventoryItems.voidedAt),
      )).returning({ id: inventoryItems.id })
      matched = gone.length
    } catch (err) {
      console.error(`[inventory] remove for ${who.bookingId}:`, err)
      back('dberr')
    }
    /* Outside the catch on purpose. back() redirects by throwing, so calling
       it in the try above handed the NEXT_REDIRECT straight to the catch,
       which logged it as a database failure and told the maker her removal
       had broken when it had merely matched nothing. */
    /* Nothing matched: a stale tab, or a double press where the first one
       won. Saying "removed" to somebody whose line is still there is how a
       maker stops believing the page. */
    if (matched === 0) back('gone')

    revalidatePath('/account')
    back('removed')
  })
}

/**
 * "That is my list."
 *
 * Drew, 29 October: a maker needs to be able to say they are finished, and
 * that is what crosses the row off their to-do list. Typing one line never
 * should have.
 *
 * Not a lock. They can still add and remove afterwards, and the card asks
 * them to press it again if they do. The Show's inventory date is what
 * actually ends it.
 */
export async function submitInventory(): Promise<void> {
  await guard('submit', async () => {
    const who = await whoIsAsking()
    if ('no' in who) back(who.no)
    /* The same guard the other three carry. Only the rendered button stopped a
       replayed or stale post from stamping a list as final after the date. */
    if (!who.open) back('shut')

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.bookingId, who.bookingId), isNull(inventoryItems.voidedAt)))
    if (Number(n) === 0) back('empty')

    await db.update(bookings)
      .set({
        inventorySubmittedAt: new Date().toISOString(),
        inventorySubmittedBy: 'maker',
      })
      .where(eq(bookings.id, who.bookingId))

    revalidatePath('/account')
    revalidatePath('/admin/roster')
    back('sent')
  })
}
