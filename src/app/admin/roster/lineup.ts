'use server'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { backTo } from './resend-lines'

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
 * Show or hide one maker on the public lineup.
 *
 * Not the same thing as taking their space back. Drew, 25 Sept: "they want to
 * remove Maddy from the makers page for now. I think there's a chance of that
 * person pays but hasn't yet." Cancelling would return her space to the pool
 * and stop her pay link taking money, which is a door slammed on somebody who
 * might still pay. This is a curtain instead: the booking, the space and the
 * link are all untouched, and /makers just does not name her.
 *
 * Reversible in one press, and the reason is kept, because in November
 * somebody will ask why a maker standing at the show was never on the site.
 */
export async function setLineupVisibility(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const hide = String(fd.get('hide') ?? '') === '1'
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect(backTo(back, 'lineup', 'missing'))

  const already = Boolean(b.lineupHiddenAt)
  if (already === hide) redirect(backTo(back, 'lineup', hide ? 'hidden' : 'listed'))

  const who = await staffActor()
  const after = hide
    ? {
      lineupHiddenAt: new Date().toISOString(),
      lineupHiddenBy: who,
      lineupHiddenReason: reason || 'no reason given',
    }
    : { lineupHiddenAt: null, lineupHiddenBy: null, lineupHiddenReason: null }

  await db.update(bookings).set(after).where(eq(bookings.id, bookingId))

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: hide ? 'lineup_hidden' : 'lineup_listed',
    before: JSON.stringify({ lineupHiddenAt: b.lineupHiddenAt }),
    after: JSON.stringify({ lineupHiddenAt: after.lineupHiddenAt }),
    reason: reason || 'no reason given',
    actor: who,
  })

  revalidatePath('/makers')
  revalidatePath('/admin/roster')
  redirect(backTo(back, 'lineup', hide ? 'hidden' : 'listed'))
}
