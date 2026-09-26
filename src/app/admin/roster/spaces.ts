'use server'

import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookingSpaces, bookings, spaceTypes } from '@/db/schema'
import { dropLiveCheckout } from '@/server/modules/payments/booth'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { grantProblem, priceFromDollars } from '@/server/modules/roster/spaces'
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
 * Give a maker another space, priced or free.
 *
 * Outdoors a space is a day, so this is how JC Beans gets all three. Leaving
 * the price empty grants it at no charge, which is the common case and is
 * deliberately not the same as typing 0: access and invoicing are separate
 * decisions (see server/modules/roster/spaces.ts).
 *
 * A priced space becomes its own line on the invoice immediately, so the
 * maker can be re-invoiced from the same screen. It never touches payment
 * state, which only a verified Stripe webhook may set (rule 5).
 */
export async function grantBoothSpace(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const spaceTypeId = String(fd.get('spaceTypeId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')
  const price = priceFromDollars(String(fd.get('dollars') ?? ''))

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect(backTo(back, 'space', 'missing'))

  const [booked, want, held] = await Promise.all([
    db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, b.spaceTypeId) }),
    db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, spaceTypeId) }),
    db.select({ spaceTypeId: bookingSpaces.spaceTypeId })
      .from(bookingSpaces)
      .where(and(eq(bookingSpaces.bookingId, bookingId), isNull(bookingSpaces.voidedAt))),
  ])

  const problem = grantProblem({
    holdsSpace: holdsSpace(b.status),
    bookingTrack: booked?.track,
    spaceTrack: want?.track,
    alreadyHas: held.some((h) => h.spaceTypeId === spaceTypeId),
    priceCents: price,
  })
  if (problem) redirect(backTo(back, 'space', problem))

  const who = await staffActor()
  await db.insert(bookingSpaces).values({
    id: randomUUID(),
    bookingId,
    spaceTypeId,
    priceCents: price as number | null,
    createdBy: who,
  })

  /* Only when it costs something. A free day changes what she has access to
     and not what she owes, so there is no stale checkout to kill and no
     reason to make the next one need a fresh idempotency key. */
  if (price !== null) {
    await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
      .where(eq(bookings.id, bookingId))
    await dropLiveCheckout(db, bookingId)
  }

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'space_granted',
    before: null,
    after: JSON.stringify({ space: want?.label ?? '', priceCents: price }),
    reason: reason || 'no reason given',
    actor: who,
  })

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'space', price === null ? 'free' : 'granted'))
}

/**
 * Take a space back off a maker.
 *
 * Voided, never deleted (rule 3). Refused when it is the only space she
 * holds: a maker with no space is a maker who is not at the show, and that
 * decision belongs to the remove control with its reason and its red
 * treatment, not to this one.
 */
export async function revokeBoothSpace(fd: FormData): Promise<void> {
  const spaceId = String(fd.get('spaceId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  const [row] = await db
    .select({
      id: bookingSpaces.id,
      bookingId: bookingSpaces.bookingId,
      priceCents: bookingSpaces.priceCents,
      voidedAt: bookingSpaces.voidedAt,
      label: spaceTypes.label,
    })
    .from(bookingSpaces)
    .innerJoin(spaceTypes, eq(bookingSpaces.spaceTypeId, spaceTypes.id))
    .where(eq(bookingSpaces.id, spaceId))
    .limit(1)
  if (!row) redirect(backTo(back, 'space', 'missing'))
  if (row.voidedAt) redirect(backTo(back, 'space', 'already'))

  const live = await db.select({ id: bookingSpaces.id })
    .from(bookingSpaces)
    .where(and(eq(bookingSpaces.bookingId, row.bookingId), isNull(bookingSpaces.voidedAt)))
  if (live.length <= 1) redirect(backTo(back, 'space', 'last_one'))

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, row.bookingId) })
  const who = await staffActor()

  await db.update(bookingSpaces).set({
    voidedAt: new Date().toISOString(),
    voidedBy: who,
    voidReason: reason || 'no reason given',
  }).where(eq(bookingSpaces.id, spaceId))

  if (row.priceCents !== null && b) {
    await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
      .where(eq(bookings.id, row.bookingId))
    await dropLiveCheckout(db, row.bookingId)
  }

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: row.bookingId,
    action: 'space_revoked',
    before: JSON.stringify({ space: row.label, priceCents: row.priceCents }),
    after: null,
    reason: reason || 'no reason given',
    actor: who,
  })

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'space', 'removed'))
}
