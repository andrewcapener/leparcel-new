'use server'

import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings, spaceTypes, vendors } from '@/db/schema'
import { activeShow } from '@/db/queries'
import {
  orderedIds, orderChanges, visibilityChanges,
} from '@/server/modules/roster/lineup-board'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'

/** Who pressed it (rule 3). The audit log carries a name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Save the board: the order everything was dragged into, and who is shown.
 *
 * One press for both, because they are one decision. Elise is looking at the
 * grid deciding what it should look like, not performing two separate
 * administrative acts.
 *
 * The board is rebuilt from the database rather than trusted from the form,
 * so a stale tab cannot hide a maker who was added after it loaded, and an id
 * from another show cannot be written at all. See lineup-board.ts for what
 * survives a round trip and what does not.
 *
 * Only rows that actually changed are written, so moving one card does not
 * leave eighty eight audit entries behind it.
 */
export async function saveLineup(fd: FormData): Promise<void> {
  const show = await activeShow()
  if (!show) redirect('/admin/lineup')

  const rows = await db
    .select({
      id: bookings.id,
      lineupOrder: bookings.lineupOrder,
      hidden: bookings.lineupHiddenAt,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(and(
      eq(bookings.showId, show.id),
      inArray(bookings.status, ['confirmed', 'payment_processing', 'awaiting_payment']),
    ))

  const known = rows.map((r) => r.id)
  const ordered = orderedIds(String(fd.get('order') ?? ''), known)
  const moves = orderChanges(ordered, new Map(rows.map((r) => [r.id, r.lineupOrder])))
  const { hide, list } = visibilityChanges(
    fd.getAll('shown').map(String), known,
    new Set(rows.filter((r) => r.hidden).map((r) => r.id)),
  )

  const who = await staffActor()
  const now = new Date().toISOString()

  for (const m of moves) {
    await db.update(bookings).set({ lineupOrder: m.lineupOrder }).where(eq(bookings.id, m.id))
  }
  if (hide.length > 0) {
    await db.update(bookings)
      .set({ lineupHiddenAt: now, lineupHiddenBy: who, lineupHiddenReason: 'from the lineup board' })
      .where(and(inArray(bookings.id, hide), isNull(bookings.lineupHiddenAt)))
  }
  if (list.length > 0) {
    await db.update(bookings)
      .set({ lineupHiddenAt: null, lineupHiddenBy: null, lineupHiddenReason: null })
      .where(inArray(bookings.id, list))
  }

  /* One audit row for the press, not one per card: the board is a single
     editorial act and reads back as one. Each maker whose visibility changed
     is named, because that is the part somebody comes asking about. */
  if (moves.length > 0 || hide.length > 0 || list.length > 0) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'lineup_saved',
      before: JSON.stringify({ hiddenCount: rows.filter((r) => r.hidden).length }),
      after: JSON.stringify({ moved: moves.length, hidden: hide, listed: list }),
      reason: 'lineup board',
      actor: who,
    })
  }

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  redirect(`/admin/lineup?moved=${moves.length}&hid=${hide.length}&lit=${list.length}`)
}
