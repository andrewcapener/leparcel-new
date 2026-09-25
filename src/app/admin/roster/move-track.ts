'use server'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings, spaceTypes } from '@/db/schema'
import { dropLiveCheckout } from '@/server/modules/payments/booth'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { moveProblem } from '@/server/modules/roster/track'
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
 * Move a maker to the other track.
 *
 * See src/server/modules/roster/track.ts for why this is its own door rather
 * than a hole cut in setBoothSpace.
 *
 * What it changes is one column: the booked space. Everything that should
 * follow reads the booked space already, or does now: the day on the public
 * lineup, whether a seller's permit is owed, whether payouts need setting up,
 * and whether a commission is taken.
 *
 * What it deliberately does NOT change:
 *   - the fee. `bookings.price_cents` is the snapshot the invoice is built
 *     from, so nothing is owed or refunded by moving. If the fee should also
 *     change, that is the fee control, pressed on purpose.
 *   - `bookings.commission_bps`. Immutable by rule 6, and harmless: an
 *     outdoor maker's commission is read from their track, not from this.
 *   - the application. It records what she applied as, which is history and
 *     stays true (rule 3).
 *   - payment state, which only a verified Stripe webhook may set (rule 5).
 */
export async function moveBoothTrack(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const spaceTypeId = String(fd.get('spaceTypeId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect(backTo(back, 'move', 'missing'))

  const [had, next] = await Promise.all([
    db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, b.spaceTypeId) }),
    db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, spaceTypeId) }),
  ])

  const problem = moveProblem({
    holdsSpace: holdsSpace(b.status),
    fromTrack: had?.track,
    toTrack: next?.track,
    fromSpaceId: b.spaceTypeId,
    toSpaceId: spaceTypeId,
  })
  if (problem) redirect(backTo(back, 'move', problem))

  await db.update(bookings).set({ spaceTypeId }).where(eq(bookings.id, bookingId))

  /* A Session's line items are fixed at creation. This one does not change the
     total, but it does change the space the maker thinks she is buying, and a
     half finished checkout naming the old one is worth killing. */
  await dropLiveCheckout(db, bookingId)

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'track_moved',
    before: JSON.stringify({ spaceTypeId: b.spaceTypeId, label: had?.label ?? '', track: had?.track ?? '' }),
    after: JSON.stringify({ spaceTypeId, label: next?.label ?? '', track: next?.track ?? '' }),
    reason: reason || 'no reason given',
    actor: await staffActor(),
  })

  /* The day is a tab on the public lineup, and the track decides which. */
  revalidatePath('/makers')
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'move', 'moved'))
}
