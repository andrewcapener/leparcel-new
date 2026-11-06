'use server'

import { randomUUID } from 'crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings, inventoryBreaks, inventoryItems, shows } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { readPastedList } from '@/server/modules/inventory/lines'
import { pushInventoryTabsIfConnected } from '@/server/modules/roster/sheet-push'
import { backTo } from './resend-lines'

/** Who pressed it (rule 3). A name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Put a maker's prices in for her, from something she sent another way.
 *
 * Until now only the maker could. Every path into inventory hung off her own
 * sign-in, which is correct as a default and useless as the only option: in
 * four days two makers sent their lists by email instead. MM40 because the
 * deadline had locked him out, and Spurs & Saddles because emailing a list
 * is what a person does. Both times the answer was "go and type it in
 * yourself", which some of them will not do, and the alternative was somebody
 * here keying forty prices into a form meant for one line at a time.
 *
 * The same parser the maker's own box uses, so a list that would have worked
 * for her works here, multi-buys and all. What it is NOT is a second way to
 * decide anything: it appends to her list, it never replaces it, and it is
 * audit-logged as staff entered so that in December it is clear who typed
 * what. Her own box keeps working while this exists.
 *
 * The deadline is deliberately not checked. Staff were never the ones the
 * date was for, and the whole reason somebody is pasting here is that the
 * maker could not.
 */
export async function pasteInventoryForMaker(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const back = String(fd.get('back') ?? '/admin/roster')
  const raw = String(fd.get('list') ?? '')

  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!booking) redirect(backTo(back, 'inv', 'missing'))

  const read = readPastedList(raw)
  if (read.lines.length === 0) redirect(backTo(back, 'inv', 'nolines'))

  const who = await staffActor()

  /* Appended after whatever she already has, so pasting twice adds twice
     rather than quietly overwriting work she did herself. */
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
      /* Not 'maker'. She did not type this and the record should not say she
         did, which matters the first time a price is disputed. */
      createdBy: who,
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
    action: 'inventory_pasted_by_staff',
    actor: who,
    before: null,
    after: JSON.stringify({
      added: made.length,
      refused: read.bad.length,
      labels: made.map((m) => m.row.label || '(no name)').slice(0, 40),
    }),
    reason: 'pasted in on the maker’s behalf from something she sent',
  })

  /* Straight onto the team's sheet, so Elise prints what was just added
     rather than yesterday evening. Capped and swallowed inside. */
  const show = await db.query.shows.findFirst({ where: eq(shows.id, booking.showId) })
  await pushInventoryTabsIfConnected(db, booking.showId, show?.paymentSheetId ?? null)

  revalidatePath('/account')
  revalidatePath('/admin/roster')
  /* How many went in, and how many did not, because a line this could not
     read is a line somebody has to look at rather than assume arrived. */
  redirect(backTo(back, 'inv', read.bad.length > 0 ? 'some' : 'all', made.length))
}
